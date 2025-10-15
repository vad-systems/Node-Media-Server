import { Socket } from 'net';
import QueryString from 'querystring';
import { context, Logger, av, amf, NodeCoreUtils } from './core/index.js';
import { NodeHttpSession } from './node_http_session.js';
import Handshake from './node_rtmp_handshake.js';
import { NodeSession } from './node_session.js';
import { RtmpSessionConfig, SessionID } from './types/index.js';

const N_CHUNK_STREAM = 8;
const RTMP_VERSION = 3;
const RTMP_HANDSHAKE_SIZE = 1536;
const RTMP_HANDSHAKE_UNINIT = 0;
const RTMP_HANDSHAKE_0 = 1;
const RTMP_HANDSHAKE_1 = 2;
const RTMP_HANDSHAKE_2 = 3;

const RTMP_PARSE_INIT = 0;
const RTMP_PARSE_BASIC_HEADER = 1;
const RTMP_PARSE_MESSAGE_HEADER = 2;
const RTMP_PARSE_EXTENDED_TIMESTAMP = 3;
const RTMP_PARSE_PAYLOAD = 4;

const MAX_CHUNK_HEADER = 18;

const RTMP_CHUNK_TYPE_0 = 0; // 11-bytes: timestamp(3) + length(3) + stream type(1) + stream id(4)
const RTMP_CHUNK_TYPE_1 = 1; // 7-bytes: delta(3) + length(3) + stream type(1)
const RTMP_CHUNK_TYPE_2 = 2; // 3-bytes: delta(3)
const RTMP_CHUNK_TYPE_3 = 3; // 0-byte

const RTMP_CHANNEL_PROTOCOL = 2;
const RTMP_CHANNEL_INVOKE = 3;
const RTMP_CHANNEL_AUDIO = 4;
const RTMP_CHANNEL_VIDEO = 5;
const RTMP_CHANNEL_DATA = 6;

const rtmpHeaderSize = [11, 7, 3, 0];

/* Protocol Control Messages */
const RTMP_TYPE_SET_CHUNK_SIZE = 1;
const RTMP_TYPE_ABORT = 2;
const RTMP_TYPE_ACKNOWLEDGEMENT = 3; // bytes read report
const RTMP_TYPE_WINDOW_ACKNOWLEDGEMENT_SIZE = 5; // server bandwidth
const RTMP_TYPE_SET_PEER_BANDWIDTH = 6; // client bandwidth

/* User Control Messages Event (4) */
const RTMP_TYPE_EVENT = 4;

const RTMP_TYPE_AUDIO = 8;
const RTMP_TYPE_VIDEO = 9;

/* Data Message */
const RTMP_TYPE_FLEX_STREAM = 15; // AMF3
const RTMP_TYPE_DATA = 18; // AMF0

/* Shared Object Message */
const RTMP_TYPE_FLEX_OBJECT = 16; // AMF3
const RTMP_TYPE_SHARED_OBJECT = 19; // AMF0

/* Command Message */
const RTMP_TYPE_FLEX_MESSAGE = 17; // AMF3
const RTMP_TYPE_INVOKE = 20; // AMF0

/* Aggregate Message */
const RTMP_TYPE_METADATA = 22;

const RTMP_CHUNK_SIZE = 128;
const RTMP_PING_TIME = 60;
const RTMP_PING_TIMEOUT = 30000;

enum StreamStatus {
    BEGIN = 0x00,
    EOF = 0x01,
    DRY = 0x02,
    EMPTY = 0x1f,
    READY = 0x20,
}

// Enhancing RTMP, FLV  2023-03-v1.0.0-B.9
// https://github.com/veovera/enhanced-rtmp
const FourCC_AV1 = Buffer.from('av01');
const FourCC_VP9 = Buffer.from('vp09');
const FourCC_HEVC = Buffer.from('hvc1');

type AMF0EncodableType = string | number | object | true | false | undefined | null;

type AMF0CommandType = {
    cmd: AMF0EncodableType | AMF0EncodableType[],
}

enum PacketType {
    SEQUENCE_START = 0,
    CODED_FRAMES = 1,
    SEQUENCE_END = 2,
    CODED_FRAMES_X = 3,
    METADATA = 4,
    MPEG2TS_SEQUENCE_START = 5,
}

type BitrateCache = {
    intervalMs: number;
    last_update: number;
    bytes: number;
}

type RtmpPacketHeader = {
    fmt: number;
    cid: number;
    timestamp: number;
    length: number;
    type: number;
    stream_id: number;
}

type RtmpPacket<T> = {
    header: RtmpPacketHeader;
    clock: number;
    payload: T;
    capacity: number;
    bytes: number;
}

function createRtmpPacket<T>(payload: T, fmt = 0, cid = 0): RtmpPacket<T> {
    return {
        header: {
            fmt: fmt,
            cid: cid,
            timestamp: 0,
            length: 0,
            type: 0,
            stream_id: 0,
        },
        clock: 0,
        payload,
        capacity: 0,
        bytes: 0,
    };
}

class NodeRtmpSession extends NodeSession<never, RtmpSessionConfig> {
    socket: Socket;
    res: Socket;
    handshakePayload = Buffer.alloc(RTMP_HANDSHAKE_SIZE);
    handshakeState = RTMP_HANDSHAKE_UNINIT;
    handshakeBytes = 0;

    parserBuffer = Buffer.alloc(MAX_CHUNK_HEADER);
    parserState = RTMP_PARSE_INIT;
    parserBytes = 0;
    parserBasicBytes = 0;
    parserPacket: RtmpPacket<Buffer> | null = null;
    inPackets: Map<number, RtmpPacket<Buffer>> = new Map();

    inChunkSize = RTMP_CHUNK_SIZE;
    outChunkSize: number;
    pingTime: number;
    pingTimeout: number;
    pingInterval: NodeJS.Timeout | null = null;

    isStarting = false;
    isPublishing = false;
    isPlaying = false;
    isIdling = false;
    isPause = false;
    isReceiveAudio = true;
    isReceiveVideo = true;

    metaData: Buffer | null = null;
    aacSequenceHeader: Buffer | null = null;
    avcSequenceHeader: Buffer | null = null;
    audioCodec = 0;
    audioCodecName = '';
    audioProfileName = '';
    audioSamplerate = 0;
    audioChannels = 1;
    videoCodec = 0;
    videoCodecName = '';
    videoProfileName = '';
    videoWidth = 0;
    videoHeight = 0;
    videoFps = 0;
    videoCount = 0;
    videoLevel = 0;
    bitrate = 0;
    ackSize = 0;
    inAckSize = 0;
    inLastAck = 0;
    appname = '';
    streams = 0;
    playStreamId = 0;
    playStreamPath = '';
    playArgs = {};
    publishStreamId = 0;
    publishStreamPath = '';
    publishArgs = {};

    players: Set<SessionID> = new Set();
    numPlayCache = 0;
    bitrateCache?: BitrateCache;

    isFirstAudioReceived = false;
    isFirstVideoReceived = false;

    rtmpGopCacheQueue: Set<Buffer> | null = null;
    flvGopCacheQueue: Set<Buffer> | null = null;

    objectEncoding: number;
    connectTime: Date;
    startTimestamp: number;

    connectCmdObj: never | null = null;

    constructor(config: RtmpSessionConfig, socket: Socket) {
        super(config, socket.remoteAddress, 'rtmp');
        this.socket = socket;
        this.res = socket;

        this.outChunkSize = config.rtmp.chunk_size || RTMP_CHUNK_SIZE;
        this.pingTime = (
            config.rtmp.ping || RTMP_PING_TIME
        ) * 1000;
        this.pingTimeout = (
            config.rtmp.ping_timeout || RTMP_PING_TIMEOUT
        ) * 1000;

        this.rtmpGopCacheQueue = config.rtmp.gop_cache ? new Set() : null;
        this.flvGopCacheQueue = config.rtmp.gop_cache ? new Set() : null;

        context.sessions.set(this.id, this);
    }

    run() {
        this.socket.on('data', this.onSocketData.bind(this));
        this.socket.on('close', this.onSocketClose.bind(this));
        this.socket.on('error', this.onSocketError.bind(this));
        this.socket.on('timeout', this.onSocketTimeout.bind(this));
        this.socket.setTimeout(this.pingTimeout);
        this.isStarting = true;
    }

    stop() {
        if (this.isStarting) {
            this.isStarting = false;

            if (this.playStreamId > 0) {
                this.onDeleteStream({ streamId: this.playStreamId });
            }

            if (this.publishStreamId > 0) {
                this.onDeleteStream({ streamId: this.publishStreamId });
            }

            if (this.pingInterval != null) {
                clearInterval(this.pingInterval);
                this.pingInterval = null;
            }

            Logger.log(`[rtmp disconnect] id=${this.id}`);

            context.nodeEvent.emit('doneConnect', this.id, this.connectCmdObj);

            context.sessions.delete(this.id);
            this.socket.destroy();
        }
    }

    reject() {
        Logger.log(`[rtmp reject] id=${this.id}`);
        this.stop();
    }

    flush() {
        if (this.numPlayCache > 0) {
            this.res.uncork();
        }
    }

    onSocketClose() {
        // Logger.log('onSocketClose');
        this.stop();
    }

    onSocketError(e: Error) {
        // Logger.log('onSocketError', e);
        this.stop();
    }

    onSocketTimeout() {
        // Logger.log('onSocketTimeout');
        this.stop();
    }

    onSocketData(data: Buffer) {
        let bytes = data.length;
        let p = 0;
        let n = 0;
        while (bytes > 0) {
            switch (this.handshakeState) {
                case RTMP_HANDSHAKE_UNINIT:
                    // Logger.log('RTMP_HANDSHAKE_UNINIT');
                    this.handshakeState = RTMP_HANDSHAKE_0;
                    this.handshakeBytes = 0;
                    bytes -= 1;
                    p += 1;
                    break;
                case RTMP_HANDSHAKE_0:
                    // Logger.log('RTMP_HANDSHAKE_0');
                    n = RTMP_HANDSHAKE_SIZE - this.handshakeBytes;
                    n = n <= bytes ? n : bytes;
                    data.copy(this.handshakePayload, this.handshakeBytes, p, p + n);
                    this.handshakeBytes += n;
                    bytes -= n;
                    p += n;
                    if (this.handshakeBytes === RTMP_HANDSHAKE_SIZE) {
                        this.handshakeState = RTMP_HANDSHAKE_1;
                        this.handshakeBytes = 0;
                        let s0s1s2 = Handshake.generateS0S1S2(this.handshakePayload);
                        this.socket.write(s0s1s2);
                    }
                    break;
                case RTMP_HANDSHAKE_1:
                    // Logger.log('RTMP_HANDSHAKE_1');
                    n = RTMP_HANDSHAKE_SIZE - this.handshakeBytes;
                    n = n <= bytes ? n : bytes;
                    data.copy(this.handshakePayload, this.handshakeBytes, p, n);
                    this.handshakeBytes += n;
                    bytes -= n;
                    p += n;
                    if (this.handshakeBytes === RTMP_HANDSHAKE_SIZE) {
                        this.handshakeState = RTMP_HANDSHAKE_2;
                        this.handshakeBytes = 0;
                        this.handshakePayload = null;
                    }
                    break;
                case RTMP_HANDSHAKE_2:
                default:
                    // Logger.log('RTMP_HANDSHAKE_2');
                    return this.rtmpChunkRead(data, p, bytes);
            }
        }
    }

    rtmpChunkBasicHeaderCreate(fmt: number, cid: number) {
        let out: Buffer;
        if (cid >= 64 + 255) {
            out = Buffer.alloc(3);
            out[0] = (
                fmt << 6
            ) | 1;
            out[1] = (
                cid - 64
            ) & 0xff;
            out[2] = (
                (
                    cid - 64
                ) >> 8
            ) & 0xff;
        } else if (cid >= 64) {
            out = Buffer.alloc(2);
            out[0] = (
                fmt << 6
            ) | 0;
            out[1] = (
                cid - 64
            ) & 0xff;
        } else {
            out = Buffer.alloc(1);
            out[0] = (
                fmt << 6
            ) | cid;
        }
        return out;
    }

    rtmpChunkMessageHeaderCreate(header: RtmpPacketHeader) {
        let out = Buffer.alloc(rtmpHeaderSize[header.fmt % 4]);
        if (header.fmt <= RTMP_CHUNK_TYPE_2) {
            out.writeUIntBE(header.timestamp >= 0xffffff ? 0xffffff : header.timestamp, 0, 3);
        }

        if (header.fmt <= RTMP_CHUNK_TYPE_1) {
            out.writeUIntBE(header.length, 3, 3);
            out.writeUInt8(header.type, 6);
        }

        if (header.fmt === RTMP_CHUNK_TYPE_0) {
            out.writeUInt32LE(header.stream_id, 7);
        }
        return out;
    }

    rtmpChunksCreate(packet: RtmpPacket<Buffer>) {
        let header = packet.header;
        let payload = packet.payload;
        let payloadSize = header.length;
        let chunkSize = this.outChunkSize;
        let chunksOffset = 0;
        let payloadOffset = 0;
        let chunkBasicHeader = this.rtmpChunkBasicHeaderCreate(header.fmt, header.cid);
        let chunkBasicHeader3 = this.rtmpChunkBasicHeaderCreate(RTMP_CHUNK_TYPE_3, header.cid);
        let chunkMessageHeader = this.rtmpChunkMessageHeaderCreate(header);
        let useExtendedTimestamp = header.timestamp >= 0xffffff;
        let headerSize = chunkBasicHeader.length + chunkMessageHeader.length + (
            useExtendedTimestamp ? 4 : 0
        );
        let n = headerSize + payloadSize + Math.floor(payloadSize / chunkSize);

        if (useExtendedTimestamp) {
            n += Math.floor(payloadSize / chunkSize) * 4;
        }
        if (!(
            payloadSize % chunkSize
        )) {
            n -= 1;
            if (useExtendedTimestamp) {
                //TODO CHECK
                n -= 4;
            }
        }

        let chunks = Buffer.alloc(n);
        chunkBasicHeader.copy(chunks, chunksOffset);
        chunksOffset += chunkBasicHeader.length;
        chunkMessageHeader.copy(chunks, chunksOffset);
        chunksOffset += chunkMessageHeader.length;
        if (useExtendedTimestamp) {
            chunks.writeUInt32BE(header.timestamp, chunksOffset);
            chunksOffset += 4;
        }
        while (payloadSize > 0) {
            if (payloadSize > chunkSize) {
                payload.copy(chunks, chunksOffset, payloadOffset, payloadOffset + chunkSize);
                payloadSize -= chunkSize;
                chunksOffset += chunkSize;
                payloadOffset += chunkSize;
                chunkBasicHeader3.copy(chunks, chunksOffset);
                chunksOffset += chunkBasicHeader3.length;
                if (useExtendedTimestamp) {
                    chunks.writeUInt32BE(header.timestamp, chunksOffset);
                    chunksOffset += 4;
                }
            } else {
                payload.copy(chunks, chunksOffset, payloadOffset, payloadOffset + payloadSize);
                payloadSize -= payloadSize;
                chunksOffset += payloadSize;
                payloadOffset += payloadSize;
            }
        }
        return chunks;
    }

    rtmpChunkRead(data: Buffer, p: number, bytes: number) {
        // Logger.log('rtmpChunkRead', p, bytes);
        let size = 0;
        let offset = 0;
        let extended_timestamp = 0;

        while (offset < bytes) {
            switch (this.parserState) {
                case RTMP_PARSE_INIT:
                    this.parserBytes = 1;
                    this.parserBuffer[0] = data[p + offset++];
                    if (0 === (
                        this.parserBuffer[0] & 0x3f
                    )) {
                        this.parserBasicBytes = 2;
                    } else if (1 === (
                        this.parserBuffer[0] & 0x3f
                    )) {
                        this.parserBasicBytes = 3;
                    } else {
                        this.parserBasicBytes = 1;
                    }
                    this.parserState = RTMP_PARSE_BASIC_HEADER;
                    break;
                case RTMP_PARSE_BASIC_HEADER:
                    while (this.parserBytes < this.parserBasicBytes && offset < bytes) {
                        this.parserBuffer[this.parserBytes++] = data[p + offset++];
                    }
                    if (this.parserBytes >= this.parserBasicBytes) {
                        this.parserState = RTMP_PARSE_MESSAGE_HEADER;
                    }
                    break;
                case RTMP_PARSE_MESSAGE_HEADER:
                    size = rtmpHeaderSize[this.parserBuffer[0] >> 6] + this.parserBasicBytes;
                    while (this.parserBytes < size && offset < bytes) {
                        this.parserBuffer[this.parserBytes++] = data[p + offset++];
                    }
                    if (this.parserBytes >= size) {
                        this.rtmpPacketParse();
                        this.parserState = RTMP_PARSE_EXTENDED_TIMESTAMP;
                    }
                    break;
                case RTMP_PARSE_EXTENDED_TIMESTAMP:
                    size = rtmpHeaderSize[this.parserPacket.header.fmt] + this.parserBasicBytes;
                    if (this.parserPacket.header.timestamp === 0xffffff) {
                        size += 4;
                    }
                    while (this.parserBytes < size && offset < bytes) {
                        this.parserBuffer[this.parserBytes++] = data[p + offset++];
                    }
                    if (this.parserBytes >= size) {
                        if (this.parserPacket.header.timestamp === 0xffffff) {
                            extended_timestamp = this.parserBuffer.readUInt32BE(rtmpHeaderSize[this.parserPacket.header.fmt] + this.parserBasicBytes);
                        } else {
                            extended_timestamp = this.parserPacket.header.timestamp;
                        }

                        if (this.parserPacket.bytes === 0) {
                            if (RTMP_CHUNK_TYPE_0 === this.parserPacket.header.fmt) {
                                this.parserPacket.clock = extended_timestamp;
                            } else {
                                this.parserPacket.clock += extended_timestamp;
                            }
                            this.rtmpPacketAlloc();
                        }
                        this.parserState = RTMP_PARSE_PAYLOAD;
                    }
                    break;
                case RTMP_PARSE_PAYLOAD:
                    size = Math.min(this.inChunkSize - (
                        this.parserPacket.bytes % this.inChunkSize
                    ), this.parserPacket.header.length - this.parserPacket.bytes);
                    size = Math.min(size, bytes - offset);
                    if (size > 0) {
                        data.copy(this.parserPacket.payload, this.parserPacket.bytes, p + offset, p + offset + size);
                    }
                    this.parserPacket.bytes += size;
                    offset += size;

                    if (this.parserPacket.bytes >= this.parserPacket.header.length) {
                        this.parserState = RTMP_PARSE_INIT;
                        this.parserPacket.bytes = 0;
                        if (this.parserPacket.clock > 0xffffffff) {
                            break;
                        }
                        this.rtmpHandler();
                    } else if (0 === this.parserPacket.bytes % this.inChunkSize) {
                        this.parserState = RTMP_PARSE_INIT;
                    }
                    break;
            }
        }

        this.inAckSize += data.length;
        if (this.inAckSize >= 0xf0000000) {
            this.inAckSize = 0;
            this.inLastAck = 0;
        }
        if (this.ackSize > 0 && this.inAckSize - this.inLastAck >= this.ackSize) {
            this.inLastAck = this.inAckSize;
            this.sendACK(this.inAckSize);
        }

        if (this.bitrateCache) {
            this.bitrateCache.bytes += bytes;
            let current_time = Date.now();
            let diff = current_time - this.bitrateCache.last_update;
            if (diff >= this.bitrateCache.intervalMs) {
                this.bitrate = Math.round(this.bitrateCache.bytes * 8 / diff);
                this.bitrateCache.bytes = 0;
                this.bitrateCache.last_update = current_time;
            }
        }
    }

    rtmpPacketParse() {
        let fmt = this.parserBuffer[0] >> 6;
        let cid = 0;
        if (this.parserBasicBytes === 2) {
            cid = 64 + this.parserBuffer[1];
        } else if (this.parserBasicBytes === 3) {
            cid = (
                64 + this.parserBuffer[1] + this.parserBuffer[2]
            ) << 8;
        } else {
            cid = this.parserBuffer[0] & 0x3f;
        }
        let hasp = this.inPackets.has(cid);
        if (!hasp) {
            this.parserPacket = createRtmpPacket(null, fmt, cid);
            this.inPackets.set(cid, this.parserPacket);
        } else {
            this.parserPacket = this.inPackets.get(cid);
        }
        this.parserPacket.header.fmt = fmt;
        this.parserPacket.header.cid = cid;
        this.rtmpChunkMessageHeaderRead();

        if (this.parserPacket.header.type > RTMP_TYPE_METADATA) {
            Logger.error('rtmp packet parse error.', this.parserPacket);
            this.stop();
        }
    }

    rtmpChunkMessageHeaderRead() {
        let offset = this.parserBasicBytes;

        // timestamp / delta
        if (this.parserPacket.header.fmt <= RTMP_CHUNK_TYPE_2) {
            this.parserPacket.header.timestamp = this.parserBuffer.readUIntBE(offset, 3);
            offset += 3;
        }

        // message length + type
        if (this.parserPacket.header.fmt <= RTMP_CHUNK_TYPE_1) {
            this.parserPacket.header.length = this.parserBuffer.readUIntBE(offset, 3);
            this.parserPacket.header.type = this.parserBuffer[offset + 3];
            offset += 4;
        }

        if (this.parserPacket.header.fmt === RTMP_CHUNK_TYPE_0) {
            this.parserPacket.header.stream_id = this.parserBuffer.readUInt32LE(offset);
            offset += 4;
        }
        return offset;
    }

    rtmpPacketAlloc() {
        if (this.parserPacket.capacity < this.parserPacket.header.length) {
            this.parserPacket.payload = Buffer.alloc(this.parserPacket.header.length + 1024);
            this.parserPacket.capacity = this.parserPacket.header.length + 1024;
        }
    }

    rtmpHandler() {
        switch (this.parserPacket.header.type) {
            case RTMP_TYPE_SET_CHUNK_SIZE:
            case RTMP_TYPE_ABORT:
            case RTMP_TYPE_ACKNOWLEDGEMENT:
            case RTMP_TYPE_WINDOW_ACKNOWLEDGEMENT_SIZE:
            case RTMP_TYPE_SET_PEER_BANDWIDTH:
                return 0 === this.rtmpControlHandler() ? -1 : 0;
            case RTMP_TYPE_EVENT:
                return 0 === this.rtmpEventHandler() ? -1 : 0;
            case RTMP_TYPE_AUDIO:
                return this.rtmpAudioHandler();
            case RTMP_TYPE_VIDEO:
                return this.rtmpVideoHandler();
            case RTMP_TYPE_FLEX_MESSAGE:
            case RTMP_TYPE_INVOKE:
                return this.rtmpInvokeHandler();
            case RTMP_TYPE_FLEX_STREAM: // AMF3
            case RTMP_TYPE_DATA: // AMF0
                return this.rtmpDataHandler();
        }
    }

    rtmpControlHandler() {
        let payload = this.parserPacket.payload;
        switch (this.parserPacket.header.type) {
            case RTMP_TYPE_SET_CHUNK_SIZE:
                this.inChunkSize = payload.readUInt32BE();
                // Logger.debug('set inChunkSize', this.inChunkSize);
                break;
            case RTMP_TYPE_ABORT:
                break;
            case RTMP_TYPE_ACKNOWLEDGEMENT:
                break;
            case RTMP_TYPE_WINDOW_ACKNOWLEDGEMENT_SIZE:
                this.ackSize = payload.readUInt32BE();
                // Logger.debug('set ack Size', this.ackSize);
                break;
            case RTMP_TYPE_SET_PEER_BANDWIDTH:
                break;
        }

        return undefined; // TODO: What is supposed to be returned from this? We check against it being 0!
    }

    rtmpEventHandler() {
        return undefined; // TODO: What is supposed to be returned from this? We check against it being 0!
    }

    rtmpAudioHandler() {
        let payload = this.parserPacket.payload.slice(0, this.parserPacket.header.length);
        let sound_format = (
            payload[0] >> 4
        ) & 0x0f;
        let sound_type = payload[0] & 0x01;
        let sound_size = (
            payload[0] >> 1
        ) & 0x01;
        let sound_rate = (
            payload[0] >> 2
        ) & 0x03;

        if (this.audioCodec == 0) {
            this.audioCodec = sound_format;
            this.audioCodecName = av.AUDIO_CODEC_NAME[sound_format];
            this.audioSamplerate = av.AUDIO_SOUND_RATE[sound_rate];
            this.audioChannels = ++sound_type;

            if (sound_format == 4) {
                //Nellymoser 16 kHz
                this.audioSamplerate = 16000;
            } else if (sound_format == 5 || sound_format == 7 || sound_format == 8) {
                //Nellymoser 8 kHz | G.711 A-law | G.711 mu-law
                this.audioSamplerate = 8000;
            } else if (sound_format == 11) {
                // Speex
                this.audioSamplerate = 16000;
            } else if (sound_format == 14) {
                //  MP3 8 kHz
                this.audioSamplerate = 8000;
            }

            if (sound_format != 10 && sound_format != 13) {
                Logger.log(
                    `[rtmp publish] Handle audio. id=${this.id} streamPath=${this.publishStreamPath} sound_format=${sound_format} sound_type=${sound_type} sound_size=${sound_size} sound_rate=${sound_rate} codec_name=${this.audioCodecName} ${this.audioSamplerate} ${this.audioChannels}ch`,
                );
            }
        }

        if ((
            sound_format == 10 || sound_format == 13
        ) && payload[1] == 0) {
            //cache aac sequence header
            this.isFirstAudioReceived = true;
            this.aacSequenceHeader = Buffer.alloc(payload.length);
            payload.copy(this.aacSequenceHeader);
            if (sound_format == 10) {
                let info = av.readAACSpecificConfig(this.aacSequenceHeader);
                this.audioProfileName = av.getAACProfileName(info);
                this.audioSamplerate = info.sample_rate;
                this.audioChannels = info.channels;
            } else {
                this.audioSamplerate = 48000;
                this.audioChannels = payload[11];
            }

            Logger.log(
                `[rtmp publish] Handle audio. id=${this.id} streamPath=${this.publishStreamPath} sound_format=${sound_format} sound_type=${sound_type} sound_size=${sound_size} sound_rate=${sound_rate} codec_name=${this.audioCodecName} ${this.audioSamplerate} ${this.audioChannels}ch`,
            );
        }

        let packet = createRtmpPacket(payload);
        packet.header.fmt = RTMP_CHUNK_TYPE_0;
        packet.header.cid = RTMP_CHANNEL_AUDIO;
        packet.header.type = RTMP_TYPE_AUDIO;
        packet.header.length = packet.payload.length;
        packet.header.timestamp = this.parserPacket.clock;
        let rtmpChunks = this.rtmpChunksCreate(packet);
        let flvTag = NodeHttpSession.createFlvTag(packet);

        //cache gop
        if (this.rtmpGopCacheQueue != null) {
            if (this.aacSequenceHeader != null && payload[1] === 0) {
                //skip aac sequence header
            } else {
                this.rtmpGopCacheQueue.add(rtmpChunks);
                this.flvGopCacheQueue.add(flvTag);
            }
        }

        for (let playerId of this.players) {
            let playerSession = context.sessions.get(playerId);

            if (playerSession instanceof NodeRtmpSession) {
                if (playerSession.numPlayCache === 0) {
                    playerSession.res.cork();
                }

                if (playerSession.isStarting && playerSession.isPlaying && !playerSession.isPause && playerSession.isReceiveAudio) {
                    rtmpChunks.writeUInt32LE(playerSession.playStreamId, 8);
                    playerSession.res.write(rtmpChunks);
                }

                playerSession.numPlayCache++;

                if (playerSession.numPlayCache === 10) {
                    process.nextTick(() => playerSession.res.uncork());
                    playerSession.numPlayCache = 0;
                }
            } else if (playerSession instanceof NodeHttpSession) {
                if (playerSession.numPlayCache === 0) {
                    playerSession.res.cork();
                }

                playerSession.res.write(flvTag, null, (e: Error) => {
                    //websocket will throw an error if not set the cb when closed
                });

                playerSession.numPlayCache++;

                if (playerSession.numPlayCache === 10) {
                    process.nextTick(() => playerSession.res.uncork());
                    playerSession.numPlayCache = 0;
                }
            }
        }
    }

    rtmpVideoHandler() {
        let payload = this.parserPacket.payload.slice(0, this.parserPacket.header.length);
        let isExHeader = (
            payload[0] >> 4 & 0b1000
        ) !== 0;
        let frame_type = payload[0] >> 4 & 0b0111;
        let codec_id = payload[0] & 0x0f;
        let packetType = payload[0] & 0x0f;
        if (isExHeader) {
            if (packetType == PacketType.METADATA) {

            } else if (packetType == PacketType.SEQUENCE_END) {

            }
            let FourCC = payload.subarray(1, 5);
            if (FourCC.compare(FourCC_HEVC) == 0) {
                codec_id = 12;
                if (packetType == PacketType.SEQUENCE_START) {
                    payload[0] = 0x1c;
                    payload[1] = 0;
                    payload[2] = 0;
                    payload[3] = 0;
                    payload[4] = 0;
                } else if (packetType == PacketType.CODED_FRAMES || packetType == PacketType.CODED_FRAMES_X) {
                    if (packetType == PacketType.CODED_FRAMES) {
                        payload = payload.subarray(3);
                    } else {
                        payload[2] = 0;
                        payload[3] = 0;
                        payload[4] = 0;
                    }
                    payload[0] = frame_type << 4 | 0x0c;
                    payload[1] = 1;
                }
            } else if (FourCC.compare(FourCC_AV1) == 0) {
                codec_id = 13;
                if (packetType == PacketType.SEQUENCE_START) {
                    payload[0] = 0x1d;
                    payload[1] = 0;
                    payload[2] = 0;
                    payload[3] = 0;
                    payload[4] = 0;
                    // Logger.log("PacketType.SEQUENCE_START", payload.subarray(0, 16));
                } else if (packetType == PacketType.MPEG2TS_SEQUENCE_START) {
                    // Logger.log("PacketType.MPEG2TS_SEQUENCE_START", payload.subarray(0, 16));
                } else if (packetType == PacketType.CODED_FRAMES) {
                    // Logger.log("PacketType.CODED_FRAMES", payload.subarray(0, 16));
                    payload[0] = frame_type << 4 | 0x0d;
                    payload[1] = 1;
                    payload[2] = 0;
                    payload[3] = 0;
                    payload[4] = 0;
                }
            } else {
                Logger.log(`unsupported extension header`);
                return;
            }
        }

        if (this.videoFps === 0) {
            if (this.videoCount++ === 0) {
                setTimeout(() => {
                    this.videoFps = Math.ceil(this.videoCount / 5);
                }, 5000);
            }
        }

        if (codec_id == 7 || codec_id == 12 || codec_id == 13) {
            //cache avc sequence header
            if (frame_type == 1 && payload[1] == 0) {
                this.avcSequenceHeader = Buffer.alloc(payload.length);
                payload.copy(this.avcSequenceHeader);
                let info = av.readAVCSpecificConfig(this.avcSequenceHeader);
                this.videoWidth = info.width;
                this.videoHeight = info.height;
                this.videoProfileName = av.getAVCProfileName(info);
                this.videoLevel = info.level;
                //Logger.log(`[rtmp publish] avc sequence header`,this.avcSequenceHeader);
            }
        }

        if (this.videoCodec == 0) {
            this.videoCodec = codec_id;
            this.videoCodecName = av.VIDEO_CODEC_NAME[codec_id];
            Logger.log(
                `[rtmp publish] Handle video. id=${this.id} streamPath=${this.publishStreamPath} frame_type=${frame_type} codec_id=${codec_id} codec_name=${this.videoCodecName} ${this.videoWidth
                }x${this.videoHeight}`,
            );
        }

        let packet = createRtmpPacket(payload);
        packet.header.fmt = RTMP_CHUNK_TYPE_0;
        packet.header.cid = RTMP_CHANNEL_VIDEO;
        packet.header.type = RTMP_TYPE_VIDEO;
        packet.header.length = packet.payload.length;
        packet.header.timestamp = this.parserPacket.clock;
        let rtmpChunks = this.rtmpChunksCreate(packet);
        let flvTag = NodeHttpSession.createFlvTag(packet);

        //cache gop
        if (this.rtmpGopCacheQueue != null) {
            if (frame_type == 1) {
                this.rtmpGopCacheQueue.clear();
                this.flvGopCacheQueue.clear();
            }
            if ((
                codec_id == 7 || codec_id == 12 || codec_id == 13
            ) && frame_type == 1 && payload[1] == 0) {
                //skip avc sequence header
            } else {
                this.rtmpGopCacheQueue.add(rtmpChunks);
                this.flvGopCacheQueue.add(flvTag);
            }
        }

        // Logger.log(rtmpChunks);
        for (let playerId of this.players) {
            let playerSession = context.sessions.get(playerId);

            if (playerSession instanceof NodeRtmpSession) {
                if (playerSession.numPlayCache === 0) {
                    playerSession.res.cork();
                }

                if (playerSession.isStarting && playerSession.isPlaying && !playerSession.isPause && playerSession.isReceiveVideo) {
                    rtmpChunks.writeUInt32LE(playerSession.playStreamId, 8);
                    playerSession.res.write(rtmpChunks);
                }

                playerSession.numPlayCache++;

                if (playerSession.numPlayCache === 10) {
                    process.nextTick(() => playerSession.res.uncork());
                    playerSession.numPlayCache = 0;
                }
            } else if (playerSession instanceof NodeHttpSession) {
                if (playerSession.numPlayCache === 0) {
                    playerSession.res.cork();
                }

                playerSession.res.write(flvTag, null, e => {
                    //websocket will throw a error if not set the cb when closed
                });

                playerSession.numPlayCache++;

                if (playerSession.numPlayCache === 10) {
                    process.nextTick(() => playerSession.res.uncork());
                    playerSession.numPlayCache = 0;
                }
            }
        }
    }

    rtmpDataHandler() {
        let offset = this.parserPacket.header.type === RTMP_TYPE_FLEX_STREAM ? 1 : 0;
        let payload = this.parserPacket.payload.slice(offset, this.parserPacket.header.length);
        let dataMessage = amf.decodeAmf0Data(payload);
        switch (dataMessage.cmd) {
            case '@setDataFrame':
                let dataObj: {
                    audiosamplerate: number;
                    stereo: boolean;
                    width: number;
                    height: number;
                    framerate: number;
                };
                if (dataMessage.hasOwnProperty('dataObj')) {
                    dataObj = dataMessage['dataObj'];
                    this.audioSamplerate = dataObj.audiosamplerate;
                    this.audioChannels = dataObj.stereo ? 2 : 1;
                    this.videoWidth = dataObj.width;
                    this.videoHeight = dataObj.height;
                    this.videoFps = dataObj.framerate;
                }

                let opt = {
                    cmd: 'onMetaData',
                    dataObj,
                };
                this.metaData = amf.encodeAmf0Data(opt);

                let packet = createRtmpPacket(this.metaData);
                packet.header.fmt = RTMP_CHUNK_TYPE_0;
                packet.header.cid = RTMP_CHANNEL_DATA;
                packet.header.type = RTMP_TYPE_DATA;
                packet.header.length = packet.payload.length;
                let rtmpChunks = this.rtmpChunksCreate(packet);
                let flvTag = NodeHttpSession.createFlvTag(packet);

                for (let playerId of this.players) {
                    let playerSession = context.sessions.get(playerId);
                    if (playerSession instanceof NodeRtmpSession) {
                        if (playerSession.isStarting && playerSession.isPlaying && !playerSession.isPause) {
                            rtmpChunks.writeUInt32LE(playerSession.playStreamId, 8);
                            playerSession.socket.write(rtmpChunks);
                        }
                    } else if (playerSession instanceof NodeHttpSession) {
                        playerSession.res.write(flvTag, null, (e: Error) => {
                            //websocket will throw an error if not set the cb when closed
                        });
                    }
                }
                break;
        }
    }

    rtmpInvokeHandler() {
        let offset = this.parserPacket.header.type === RTMP_TYPE_FLEX_MESSAGE ? 1 : 0;
        let payload = this.parserPacket.payload.slice(offset, this.parserPacket.header.length); // TODO: Deprecation
        let invokeMessage = amf.decodeAmf0Cmd(payload);
        Logger.debug(this.id, invokeMessage.cmd, invokeMessage);
        switch (invokeMessage.cmd) {
            case 'connect':
                this.onConnect(invokeMessage);
                break;
            case 'releaseStream':
                break;
            case 'FCPublish':
                break;
            case 'createStream':
                this.onCreateStream(invokeMessage);
                break;
            case 'publish':
                this.onPublish(invokeMessage);
                break;
            case 'play':
                this.onPlay(invokeMessage);
                break;
            case 'pause':
                this.onPause(invokeMessage);
                break;
            case 'FCUnpublish':
                break;
            case 'deleteStream':
                this.onDeleteStream(invokeMessage);
                break;
            case 'closeStream':
                this.onCloseStream();
                break;
            case 'receiveAudio':
                this.onReceiveAudio(invokeMessage);
                break;
            case 'receiveVideo':
                this.onReceiveVideo(invokeMessage);
                break;
        }
    }

    sendACK(size: number) {
        let rtmpBuffer = Buffer.from('02000000000004030000000000000000', 'hex');
        rtmpBuffer.writeUInt32BE(size, 12);
        this.socket.write(rtmpBuffer);
    }

    sendWindowACK(size: number) {
        let rtmpBuffer = Buffer.from('02000000000004050000000000000000', 'hex');
        rtmpBuffer.writeUInt32BE(size, 12);
        this.socket.write(rtmpBuffer);
    }

    setPeerBandwidth(size: number, type: number) {
        let rtmpBuffer = Buffer.from('0200000000000506000000000000000000', 'hex');
        rtmpBuffer.writeUInt32BE(size, 12);
        rtmpBuffer[16] = type;
        this.socket.write(rtmpBuffer);
    }

    setChunkSize(size: number) {
        let rtmpBuffer = Buffer.from('02000000000004010000000000000000', 'hex');
        rtmpBuffer.writeUInt32BE(size, 12);
        this.socket.write(rtmpBuffer);
    }

    sendStreamStatus(st: number, id: number) {
        let rtmpBuffer = Buffer.from('020000000000060400000000000000000000', 'hex');
        rtmpBuffer.writeUInt16BE(st, 12);
        rtmpBuffer.writeUInt32BE(id, 14);
        this.socket.write(rtmpBuffer);
    }

    sendInvokeMessage<T extends AMF0CommandType>(sid: number, opt: T) {
        let packet = createRtmpPacket(amf.encodeAmf0Cmd(opt));
        packet.header.fmt = RTMP_CHUNK_TYPE_0;
        packet.header.cid = RTMP_CHANNEL_INVOKE;
        packet.header.type = RTMP_TYPE_INVOKE;
        packet.header.stream_id = sid;
        packet.header.length = packet.payload.length;
        let chunks = this.rtmpChunksCreate(packet);
        this.socket.write(chunks);
    }

    sendDataMessage<T extends AMF0CommandType>(sid: number, opt: T) {
        let packet = createRtmpPacket(amf.encodeAmf0Data(opt));
        packet.header.fmt = RTMP_CHUNK_TYPE_0;
        packet.header.cid = RTMP_CHANNEL_DATA;
        packet.header.type = RTMP_TYPE_DATA;
        packet.header.length = packet.payload.length;
        packet.header.stream_id = sid;
        let chunks = this.rtmpChunksCreate(packet);
        this.socket.write(chunks);
    }

    sendStatusMessage(sid: number, level: string, code: string, description: string) {
        let opt = {
            cmd: 'onStatus',
            transId: 0,
            cmdObj: null,
            info: {
                level: level,
                code: code,
                description: description,
            },
        };
        this.sendInvokeMessage(sid, opt);
    }

    sendRtmpSampleAccess(sid?: number) {
        let opt = {
            cmd: '|RtmpSampleAccess',
            bool1: false,
            bool2: false,
        };
        this.sendDataMessage(sid, opt);
    }

    sendPingRequest() {
        let currentTimestamp = Date.now() - this.startTimestamp;
        const payload = Buffer.from([
            0,
            6,
            (
                currentTimestamp >> 24
            ) & 0xff,
            (
                currentTimestamp >> 16
            ) & 0xff,
            (
                currentTimestamp >> 8
            ) & 0xff,
            currentTimestamp & 0xff,
        ]);
        let packet = createRtmpPacket(payload);
        packet.header.fmt = RTMP_CHUNK_TYPE_0;
        packet.header.cid = RTMP_CHANNEL_PROTOCOL;
        packet.header.type = RTMP_TYPE_EVENT;
        packet.header.timestamp = currentTimestamp;
        packet.header.length = packet.payload.length;
        let chunks = this.rtmpChunksCreate(packet);
        this.socket.write(chunks);
    }

    respondConnect(tid) {
        let opt = {
            cmd: '_result',
            transId: tid,
            cmdObj: {
                fmsVer: 'FMS/3,0,1,123',
                capabilities: 31,
            },
            info: {
                level: 'status',
                code: 'NetConnection.Connect.Success',
                description: 'Connection succeeded.',
                objectEncoding: this.objectEncoding,
            },
        };
        this.sendInvokeMessage(0, opt);
    }

    respondCreateStream(tid) {
        this.streams++;
        let opt = {
            cmd: '_result',
            transId: tid,
            cmdObj: null,
            info: this.streams,
        };
        this.sendInvokeMessage(0, opt);
    }

    respondPlay() {
        this.sendStreamStatus(StreamStatus.BEGIN, this.playStreamId);
        this.sendStatusMessage(this.playStreamId, 'status', 'NetStream.Play.Reset', 'Playing and resetting stream.');
        this.sendStatusMessage(this.playStreamId, 'status', 'NetStream.Play.Start', 'Started playing stream.');
        this.sendRtmpSampleAccess();
    }

    onConnect(invokeMessage) {
        invokeMessage.cmdObj.app = invokeMessage.cmdObj.app.replace('/', ''); //fix jwplayer
        context.nodeEvent.emit('preConnect', this.id, invokeMessage.cmdObj);
        if (!this.isStarting) {
            return;
        }
        this.connectCmdObj = invokeMessage.cmdObj;
        this.appname = invokeMessage.cmdObj.app;
        this.objectEncoding = invokeMessage.cmdObj.objectEncoding != null ? invokeMessage.cmdObj.objectEncoding : 0;
        this.connectTime = new Date();
        this.startTimestamp = Date.now();
        this.pingInterval = setInterval(() => {
            this.sendPingRequest();
        }, this.pingTime);
        this.sendWindowACK(5000000);
        this.setPeerBandwidth(5000000, 2);
        this.setChunkSize(this.outChunkSize);
        this.respondConnect(invokeMessage.transId);
        this.bitrateCache = {
            intervalMs: 1000,
            last_update: this.startTimestamp,
            bytes: 0,
        };
        Logger.log(`[rtmp connect] id=${this.id} ip=${this.remoteIp} app=${this.appname} args=${JSON.stringify(
            invokeMessage.cmdObj)}`);
        context.nodeEvent.emit('postConnect', this.id, invokeMessage.cmdObj);
    }

    onCreateStream(invokeMessage) {
        this.respondCreateStream(invokeMessage.transId);
    }

    onPublish(invokeMessage) {
        if (typeof invokeMessage.streamName !== 'string') {
            return;
        }
        this.publishStreamPath = '/' + this.appname + '/' + invokeMessage.streamName.split('?')[0];
        this.publishArgs = QueryString.parse(invokeMessage.streamName.split('?')[1]);
        this.publishStreamId = this.parserPacket.header.stream_id;
        context.nodeEvent.emit('prePublish', this.id, this.publishStreamPath, this.publishArgs);
        if (!this.isStarting) {
            return;
        }

        if (this.conf.auth && this.conf.auth.publish && !this.isLocal) {
            let results = NodeCoreUtils.verifyAuth(
                this.publishArgs['sign'],
                this.publishStreamPath,
                this.conf.auth.secret,
            );
            if (!results) {
                Logger.log(`[rtmp publish] Unauthorized. id=${this.id} streamPath=${this.publishStreamPath} streamId=${this.publishStreamId} sign=${this.publishArgs['sign']} `);
                this.sendStatusMessage(
                    this.publishStreamId,
                    'error',
                    'NetStream.publish.Unauthorized',
                    'Authorization required.',
                );
                return;
            }
        }

        if (context.publishers.has(this.publishStreamPath)) {
            this.reject();
            Logger.log(`[rtmp publish] Already has a stream. id=${this.id} streamPath=${this.publishStreamPath} streamId=${this.publishStreamId}`);
            this.sendStatusMessage(
                this.publishStreamId,
                'error',
                'NetStream.Publish.BadName',
                'Stream already publishing',
            );
        } else if (this.isPublishing) {
            Logger.log(`[rtmp publish] NetConnection is publishing. id=${this.id} streamPath=${this.publishStreamPath} streamId=${this.publishStreamId}`);
            this.sendStatusMessage(
                this.publishStreamId,
                'error',
                'NetStream.Publish.BadConnection',
                'Connection already publishing',
            );
        } else {
            Logger.log(`[rtmp publish] New stream. id=${this.id} streamPath=${this.publishStreamPath} streamId=${this.publishStreamId}`);
            context.publishers.set(this.publishStreamPath, this.id);
            this.isPublishing = true;

            this.sendStatusMessage(
                this.publishStreamId,
                'status',
                'NetStream.Publish.Start',
                `${this.publishStreamPath} is now published.`,
            );
            for (let idlePlayerId of context.idlePlayers) {
                let idlePlayer = context.sessions.get(idlePlayerId);
                if (idlePlayer && (
                    idlePlayer instanceof NodeHttpSession || idlePlayer instanceof NodeRtmpSession
                )) {
                    if (idlePlayer.playStreamPath === this.publishStreamPath) {
                        idlePlayer.onStartPlay();
                        context.idlePlayers.delete(idlePlayerId);
                    }
                }
            }
            context.nodeEvent.emit('postPublish', this.id, this.publishStreamPath, this.publishArgs);
        }
    }

    onPlay(invokeMessage) {
        if (typeof invokeMessage.streamName !== 'string') {
            return;
        }
        this.playStreamPath = '/' + this.appname + '/' + invokeMessage.streamName.split('?')[0];
        this.playArgs = QueryString.parse(invokeMessage.streamName.split('?')[1]);
        this.playStreamId = this.parserPacket.header.stream_id;
        context.nodeEvent.emit('prePlay', this.id, this.playStreamPath, this.playArgs);

        if (!this.isStarting) {
            return;
        }

        if (this.conf.auth && this.conf.auth.play && !this.isLocal) {
            let results = NodeCoreUtils.verifyAuth(this.playArgs['sign'], this.playStreamPath, this.conf.auth.secret);
            if (!results) {
                Logger.log(`[rtmp play] Unauthorized. id=${this.id} streamPath=${this.playStreamPath}  streamId=${this.playStreamId} sign=${this.playArgs['sign']}`);
                this.sendStatusMessage(
                    this.playStreamId,
                    'error',
                    'NetStream.play.Unauthorized',
                    'Authorization required.',
                );
                return;
            }
        }

        if (this.isPlaying) {
            Logger.log(`[rtmp play] NetConnection is playing. id=${this.id} streamPath=${this.playStreamPath}  streamId=${this.playStreamId} `);
            this.sendStatusMessage(
                this.playStreamId,
                'error',
                'NetStream.Play.BadConnection',
                'Connection already playing',
            );
        } else {
            this.respondPlay();
        }

        if (context.publishers.has(this.playStreamPath)) {
            this.onStartPlay();
        } else {
            Logger.log(`[rtmp play] Stream not found. id=${this.id} streamPath=${this.playStreamPath}  streamId=${this.playStreamId}`);
            this.isIdling = true;
            context.idlePlayers.add(this.id);
        }
    }

    onStartPlay() {
        let publisherId = context.publishers.get(this.playStreamPath);
        let publisher = context.sessions.get(publisherId);

        if (!(
            publisher instanceof NodeRtmpSession
        )) {
            return;
        }

        let players = publisher.players;
        players.add(this.id);

        if (publisher.metaData != null) {
            let packet = createRtmpPacket(publisher.metaData);
            packet.header.fmt = RTMP_CHUNK_TYPE_0;
            packet.header.cid = RTMP_CHANNEL_DATA;
            packet.header.type = RTMP_TYPE_DATA;
            packet.header.length = packet.payload.length;
            packet.header.stream_id = this.playStreamId;
            let chunks = this.rtmpChunksCreate(packet);
            this.socket.write(chunks);
        }

        if (publisher.audioCodec === 10 || publisher.audioCodec === 13) {
            let packet = createRtmpPacket(publisher.aacSequenceHeader);
            packet.header.fmt = RTMP_CHUNK_TYPE_0;
            packet.header.cid = RTMP_CHANNEL_AUDIO;
            packet.header.type = RTMP_TYPE_AUDIO;
            packet.header.length = packet.payload.length;
            packet.header.stream_id = this.playStreamId;
            let chunks = this.rtmpChunksCreate(packet);
            this.socket.write(chunks);
        }

        if (publisher.videoCodec === 7 || publisher.videoCodec === 12 || publisher.videoCodec === 13) {
            let packet = createRtmpPacket(publisher.avcSequenceHeader);
            packet.header.fmt = RTMP_CHUNK_TYPE_0;
            packet.header.cid = RTMP_CHANNEL_VIDEO;
            packet.header.type = RTMP_TYPE_VIDEO;
            packet.header.length = packet.payload.length;
            packet.header.stream_id = this.playStreamId;
            let chunks = this.rtmpChunksCreate(packet);
            this.socket.write(chunks);
        }

        if (publisher.rtmpGopCacheQueue != null) {
            for (let chunks of publisher.rtmpGopCacheQueue) {
                chunks.writeUInt32LE(this.playStreamId, 8);
                this.socket.write(chunks);
            }
        }

        this.isIdling = false;
        this.isPlaying = true;
        context.nodeEvent.emit('postPlay', this.id, this.playStreamPath, this.playArgs);
        Logger.log(`[rtmp play] Join stream. id=${this.id} streamPath=${this.playStreamPath}  streamId=${this.playStreamId} `);
    }

    onPause(invokeMessage) {
        this.isPause = invokeMessage.pause;
        let c = this.isPause ? 'NetStream.Pause.Notify' : 'NetStream.Unpause.Notify';
        let d = this.isPause ? 'Paused live' : 'Unpaused live';
        Logger.log(`[rtmp play] ${d} stream. id=${this.id} streamPath=${this.playStreamPath}  streamId=${this.playStreamId} `);
        if (!this.isPause) {
            this.sendStreamStatus(StreamStatus.BEGIN, this.playStreamId);
            if (context.publishers.has(this.playStreamPath)) {
                //fix ckplayer
                let publisherId = context.publishers.get(this.playStreamPath);
                let publisher = context.sessions.get(publisherId);
                if (publisher instanceof NodeRtmpSession) {
                    if (publisher.audioCodec === 10 || publisher.audioCodec === 13) {
                        let packet = createRtmpPacket(publisher.aacSequenceHeader);
                        packet.header.fmt = RTMP_CHUNK_TYPE_0;
                        packet.header.cid = RTMP_CHANNEL_AUDIO;
                        packet.header.type = RTMP_TYPE_AUDIO;
                        packet.header.length = packet.payload.length;
                        packet.header.stream_id = this.playStreamId;
                        packet.header.timestamp = publisher.parserPacket.clock; // ?? 0 or clock
                        let chunks = this.rtmpChunksCreate(packet);
                        this.socket.write(chunks);
                    }
                    if (publisher.videoCodec === 7 || publisher.videoCodec === 12 || publisher.videoCodec === 13) {
                        let packet = createRtmpPacket(publisher.avcSequenceHeader);
                        packet.header.fmt = RTMP_CHUNK_TYPE_0;
                        packet.header.cid = RTMP_CHANNEL_VIDEO;
                        packet.header.type = RTMP_TYPE_VIDEO;
                        packet.header.length = packet.payload.length;
                        packet.header.stream_id = this.playStreamId;
                        packet.header.timestamp = publisher.parserPacket.clock; // ?? 0 or clock
                        let chunks = this.rtmpChunksCreate(packet);
                        this.socket.write(chunks);
                    }
                }
            }
        } else {
            this.sendStreamStatus(StreamStatus.EOF, this.playStreamId);
        }
        this.sendStatusMessage(this.playStreamId, 'status', c, d);
    }

    onReceiveAudio(invokeMessage) {
        this.isReceiveAudio = invokeMessage.bool;
        Logger.log(`[rtmp play] receiveAudio=${this.isReceiveAudio} id=${this.id} `);
    }

    onReceiveVideo(invokeMessage) {
        this.isReceiveVideo = invokeMessage.bool;
        Logger.log(`[rtmp play] receiveVideo=${this.isReceiveVideo} id=${this.id} `);
    }

    onCloseStream() {
        //red5-publisher
        let closeStream = { streamId: this.parserPacket.header.stream_id };
        this.onDeleteStream(closeStream);
    }

    onDeleteStream(invokeMessage) {
        if (invokeMessage.streamId == this.playStreamId) {
            if (this.isIdling) {
                context.idlePlayers.delete(this.id);
                this.isIdling = false;
            } else {
                let publisherId = context.publishers.get(this.playStreamPath);
                if (publisherId != null) {
                    const publisher = context.sessions.get(publisherId);
                    if (publisher instanceof NodeRtmpSession) {
                        publisher.players.delete(this.id);
                    }
                }
                context.nodeEvent.emit('donePlay', this.id, this.playStreamPath, this.playArgs);
                this.isPlaying = false;
            }
            Logger.log(`[rtmp play] Close stream. id=${this.id} streamPath=${this.playStreamPath} streamId=${this.playStreamId}`);
            if (this.isStarting) {
                this.sendStatusMessage(this.playStreamId, 'status', 'NetStream.Play.Stop', 'Stopped playing stream.');
            }
            this.playStreamId = 0;
            this.playStreamPath = '';
        }

        if (invokeMessage.streamId == this.publishStreamId) {
            if (this.isPublishing) {
                Logger.log(`[rtmp publish] Close stream. id=${this.id} streamPath=${this.publishStreamPath} streamId=${this.publishStreamId}`);
                context.nodeEvent.emit('donePublish', this.id, this.publishStreamPath, this.publishArgs);
                if (this.isStarting) {
                    this.sendStatusMessage(
                        this.publishStreamId,
                        'status',
                        'NetStream.Unpublish.Success',
                        `${this.publishStreamPath} is now unpublished.`,
                    );
                }

                for (let playerId of this.players) {
                    let playerSession = context.sessions.get(playerId);
                    if (playerSession instanceof NodeRtmpSession) {
                        playerSession.sendStatusMessage(
                            playerSession.playStreamId,
                            'status',
                            'NetStream.Play.UnpublishNotify',
                            'stream is now unpublished.',
                        );
                        playerSession.flush();
                    } else {
                        playerSession.stop();
                    }
                }

                //let the players to idlePlayers
                for (let playerId of this.players) {
                    let playerSession = context.sessions.get(playerId);
                    context.idlePlayers.add(playerId);
                    if (playerSession instanceof NodeRtmpSession) {
                        playerSession.isPlaying = false;
                        playerSession.isIdling = true;
                        playerSession.sendStreamStatus(StreamStatus.EOF, playerSession.playStreamId);
                    } else if (playerSession instanceof NodeHttpSession) {
                        playerSession.isPlaying = false;
                        playerSession.isIdling = true;
                    }
                }

                context.publishers.delete(this.publishStreamPath);
                if (this.rtmpGopCacheQueue) {
                    this.rtmpGopCacheQueue.clear();
                }
                if (this.flvGopCacheQueue) {
                    this.flvGopCacheQueue.clear();
                }
                this.players.clear();
                this.isPublishing = false;
            }
            this.publishStreamId = 0;
            this.publishStreamPath = '';
        }
    }
}

export { NodeRtmpSession };
