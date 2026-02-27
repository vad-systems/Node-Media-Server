import { Buffer } from 'node:buffer';
import logger from '../logger.js';
import AVPacket from './AVPacket.js';

enum FlvMediaType {
    AUDIO = 8,
    VIDEO = 9,
    SCRIPT = 18,
}

enum FlvParserState {
    INIT = 0,
    HEAD = 1,
    TAGS = 2,
    PREV = 3,
}

enum FlvFrameType {
    KEY = 1,
    INTER = 2,
    DISP_INTER = 3,
    GENERATED_KEY = 4,
    VIDEO_INFO_CMD = 5,
}

const FLV_AVC_NALU = 1;
const FLV_AVC_END_OF_SEQUENCE = 2;

export enum FlvVideoCodec {
    H263 = 2,
    SCREEN = 3,
    VP6 = 4,
    VP6A = 5,
    SCREEN2 = 6,
    VP8 = 7,
    H264 = 7,
    REALH263 = 8,
    MPEG4 = 9,
    VP9 = 8,
    SPEEX = 11,
    H265 = 12,
    AV1 = 13,
    HEVC = 15,
    MPEG2TS = 16,
}

export enum FlvAudioCodec {
    PCM = 0,
    ADPCM = 1,
    MP3 = 2,
    PCM_LE = 3,
    NELLYMOSER_16KHZ_MONO = 4,
    NELLYMOSER_8KHZ_MONO = 5,
    NELLYMOSER = 6,
    PCM_ALAW = 7,
    PCM_MULAW = 8,
    ExHeader = 9,
    AAC = 10,
    AAC_LATM = 13,
}

class FOURCC {
    public static AV1 = Buffer.from('av01');
    public static VP9 = Buffer.from('vp09');
    public static HEVC = Buffer.from('hvc1');
    public static AC3 = Buffer.from('ac-3');
    public static EAC3 = Buffer.from('ec-3');
    public static OPUS = Buffer.from('Opus');
    public static MP3 = Buffer.from('.mp3');
    public static FLAC = Buffer.from('fLaC');
    public static AAC = Buffer.from('mp4a');
}

enum VideoPacketType {
    SequenceStart = 0,
    AvcSequenceHeader = 0,
    CodedFrames = 1,
    SequenceEnd = 2,
    CodedFramesX = 3,
    Metadata = 4,
    MPEG2TSSequenceStart = 5,
}

enum AudioPacketType {
    SequenceStart = 0,
    CodedFrames = 1,
    SequenceEnd = 2,
    MultichannelConfig = 4,
    Multitrack = 5,
    TypModEx = 7,
}

class Flv {
    private parserBuffer: Buffer;
    private parserState: FlvParserState;
    private parserHeaderBytes: number;
    private parserTagBytes: number;
    private parserTagType: number;
    private parserTagSize: number;
    private parserTagTime: number;
    private parserTagCapacity: number;
    private parserTagData: Buffer;
    private parserPreviousBytes: number;

    constructor() {
        this.parserBuffer = Buffer.alloc(13);
        this.parserState = FlvParserState.INIT;
        this.parserHeaderBytes = 0;
        this.parserTagBytes = 0;
        this.parserTagType = 0;
        this.parserTagSize = 0;
        this.parserTagTime = 0;
        this.parserTagCapacity = 1024 * 1024;
        this.parserTagData = Buffer.alloc(this.parserTagCapacity);
        this.parserPreviousBytes = 0;
    }

    private onPacketCallback = (avpacket: AVPacket) => {
    };

    private parserData = (buffer: Buffer) => {
        let s = buffer.length;
        let n = 0;
        let p = 0;
        while (s > 0) {
            switch (this.parserState) {
                case FlvParserState.INIT:
                    n = 13 - this.parserHeaderBytes;
                    n = n <= s ? n : s;
                    buffer.copy(this.parserBuffer, this.parserHeaderBytes, p, p + n);
                    this.parserHeaderBytes += n;
                    s -= n;
                    p += n;
                    if (this.parserHeaderBytes === 13) {
                        this.parserState = FlvParserState.HEAD;
                        this.parserHeaderBytes = 0;
                    }
                    break;
                case FlvParserState.HEAD:
                    n = 11 - this.parserHeaderBytes;
                    n = n <= s ? n : s;
                    buffer.copy(this.parserBuffer, this.parserHeaderBytes, p, p + n);
                    this.parserHeaderBytes += n;
                    s -= n;
                    p += n;
                    if (this.parserHeaderBytes === 11) {
                        this.parserState = FlvParserState.TAGS;
                        this.parserHeaderBytes = 0;
                        this.parserTagType = this.parserBuffer[0];
                        this.parserTagSize = this.parserBuffer.readUintBE(1, 3);
                        this.parserTagTime = (
                            this.parserBuffer[4] << 16
                        ) | (
                            this.parserBuffer[5] << 8
                        ) | this.parserBuffer[6] | (
                            this.parserBuffer[7] << 24
                        );
                        logger.debug(`parser tag type=${this.parserTagType} time=${this.parserTagTime} size=${this.parserTagSize} `);
                    }
                    break;
                case FlvParserState.TAGS:
                    this.parserTagAlloc(this.parserTagSize);
                    n = this.parserTagSize - this.parserTagBytes;
                    n = n <= s ? n : s;
                    buffer.copy(this.parserTagData, this.parserTagBytes, p, p + n);
                    this.parserTagBytes += n;
                    s -= n;
                    p += n;
                    if (this.parserTagBytes === this.parserTagSize) {
                        this.parserState = FlvParserState.PREV;
                        this.parserTagBytes = 0;
                    }
                    break;
                case FlvParserState.PREV:
                    n = 4 - this.parserPreviousBytes;
                    n = n <= s ? n : s;
                    buffer.copy(this.parserBuffer, this.parserPreviousBytes, p, p + n);
                    this.parserPreviousBytes += n;
                    s -= n;
                    p += n;
                    if (this.parserPreviousBytes === 4) {
                        this.parserState = FlvParserState.HEAD;
                        this.parserPreviousBytes = 0;
                        const parserPreviousNSize = this.parserBuffer.readUint32BE();
                        if (parserPreviousNSize === this.parserTagSize + 11) {
                            let packet = Flv.parserTag(
                                this.parserTagType,
                                this.parserTagTime,
                                this.parserTagSize,
                                this.parserTagData,
                            );
                            this.onPacketCallback(packet);
                        } else {
                            return 'flv tag parser error';
                        }
                    }
                    break;
            }
        }
        return null;
    };

    private parserTagAlloc = (size: number) => {
        if (this.parserTagCapacity < size) {
            this.parserTagCapacity = size * 2;
            const newBuffer = Buffer.alloc(this.parserTagCapacity);
            this.parserTagData.copy(newBuffer);
            this.parserTagData = newBuffer;
        }
    };

    public static createHeader = (hasAudio: boolean, hasVideo: boolean) => {
        const buffer = Buffer.from([0x46, 0x4c, 0x56, 0x01, 0x00, 0x00, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00, 0x00]);

        if (hasAudio) {
            buffer[4] |= 4;
        }

        if (hasVideo) {
            buffer[4] |= 1;
        }

        return buffer;
    };

    public static createMessage = (avpacket: AVPacket) => {
        const buffer = Buffer.alloc(11 + avpacket.size + 4);
        buffer[0] = avpacket.codec_type;
        buffer.writeUintBE(avpacket.size, 1, 3);
        buffer[4] = (
            avpacket.dts >> 16
        ) & 0xFF;
        buffer[5] = (
            avpacket.dts >> 8
        ) & 0xFF;
        buffer[6] = avpacket.dts & 0xFF;
        buffer[7] = (
            avpacket.dts >> 24
        ) & 0xFF;
        avpacket.data.copy(buffer, 11, 0, avpacket.size);
        buffer.writeUint32BE(11 + avpacket.size, 11 + avpacket.size);
        return buffer;
    };

    public static parserTag = (type: number, time: number, size: number, data: Buffer) => {
        let packet = new AVPacket();
        packet.codec_type = type;
        packet.pts = time;
        packet.dts = time;
        packet.size = size;
        packet.data = data;
        if (type === FlvMediaType.AUDIO) {
            const soundFormat = data[0] >> 4;
            packet.codec_id = soundFormat;
            packet.flags = 1;
            if (soundFormat !== FlvAudioCodec.ExHeader) {
                if (soundFormat === FlvAudioCodec.AAC) {
                    if (data[1] === 0) {
                        packet.flags = 0;
                    }
                }
            } else {
                const audioPacketType = data[0] & 0x0f;
                if (audioPacketType === AudioPacketType.SequenceStart) {
                    packet.flags = 0;
                }
            }


        } else if (type === FlvMediaType.VIDEO) {
            const frameType = data[0] >> 4 & 0b0111;
            const codecID = data[0] & 0x0f;
            const isExHeader = (
                data[0] >> 4 & 0b1000
            ) !== 0;

            if (isExHeader) {
                const videoPacketType = data[0] & 0x0f;
                const fourCC = data.subarray(1, 5);
                if (fourCC.compare(FOURCC.AV1) === 0 || fourCC.compare(FOURCC.VP9) === 0 || fourCC.compare(FOURCC.HEVC) === 0) {
                    packet.codec_id = fourCC.readUint32BE();
                    if (videoPacketType === VideoPacketType.SequenceStart) {
                        packet.flags = 2;
                    } else if (videoPacketType === VideoPacketType.CodedFrames || videoPacketType === VideoPacketType.CodedFramesX) {
                        if (frameType === FlvFrameType.KEY) {
                            packet.flags = 3;
                        } else {
                            packet.flags = 4;
                        }
                    } else if (videoPacketType === VideoPacketType.Metadata) {
                        packet.flags = 6;
                    }

                    if (fourCC.compare(FOURCC.HEVC) === 0) {
                        if (videoPacketType === VideoPacketType.CodedFrames) {
                            const cts = data.readUintBE(5, 3);
                            packet.pts = packet.dts + cts;
                        }
                    }
                }
            } else {
                const cts = data.readUintBE(2, 3);
                const videoPacketType = data[1];
                packet.codec_id = codecID;
                packet.pts = packet.dts + cts;
                packet.flags = 4;
                if (codecID === FlvVideoCodec.H264) {
                    if (videoPacketType === VideoPacketType.AvcSequenceHeader) {
                        packet.flags = 2;
                    } else {
                        if (frameType === FlvFrameType.KEY) {
                            packet.flags = 3;
                        } else {
                            packet.flags = 4;
                        }
                    }
                }
            }
        } else if (type === FlvMediaType.SCRIPT) {
            packet.flags = 5;
        }
        return packet;
    };
}

export default Flv;
