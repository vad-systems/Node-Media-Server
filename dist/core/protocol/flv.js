"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlvAudioCodec = exports.FlvVideoCodec = void 0;
const node_buffer_1 = require("node:buffer");
const logger_js_1 = __importDefault(require("../logger.js"));
const AVPacket_js_1 = __importDefault(require("./AVPacket.js"));
var FlvMediaType;
(function (FlvMediaType) {
    FlvMediaType[FlvMediaType["AUDIO"] = 8] = "AUDIO";
    FlvMediaType[FlvMediaType["VIDEO"] = 9] = "VIDEO";
    FlvMediaType[FlvMediaType["SCRIPT"] = 18] = "SCRIPT";
})(FlvMediaType || (FlvMediaType = {}));
var FlvParserState;
(function (FlvParserState) {
    FlvParserState[FlvParserState["INIT"] = 0] = "INIT";
    FlvParserState[FlvParserState["HEAD"] = 1] = "HEAD";
    FlvParserState[FlvParserState["TAGS"] = 2] = "TAGS";
    FlvParserState[FlvParserState["PREV"] = 3] = "PREV";
})(FlvParserState || (FlvParserState = {}));
var FlvFrameType;
(function (FlvFrameType) {
    FlvFrameType[FlvFrameType["KEY"] = 1] = "KEY";
    FlvFrameType[FlvFrameType["INTER"] = 2] = "INTER";
    FlvFrameType[FlvFrameType["DISP_INTER"] = 3] = "DISP_INTER";
    FlvFrameType[FlvFrameType["GENERATED_KEY"] = 4] = "GENERATED_KEY";
    FlvFrameType[FlvFrameType["VIDEO_INFO_CMD"] = 5] = "VIDEO_INFO_CMD";
})(FlvFrameType || (FlvFrameType = {}));
const FLV_AVC_NALU = 1;
const FLV_AVC_END_OF_SEQUENCE = 2;
var FlvVideoCodec;
(function (FlvVideoCodec) {
    FlvVideoCodec[FlvVideoCodec["H263"] = 2] = "H263";
    FlvVideoCodec[FlvVideoCodec["SCREEN"] = 3] = "SCREEN";
    FlvVideoCodec[FlvVideoCodec["VP6"] = 4] = "VP6";
    FlvVideoCodec[FlvVideoCodec["VP6A"] = 5] = "VP6A";
    FlvVideoCodec[FlvVideoCodec["SCREEN2"] = 6] = "SCREEN2";
    FlvVideoCodec[FlvVideoCodec["VP8"] = 7] = "VP8";
    FlvVideoCodec[FlvVideoCodec["H264"] = 7] = "H264";
    FlvVideoCodec[FlvVideoCodec["REALH263"] = 8] = "REALH263";
    FlvVideoCodec[FlvVideoCodec["MPEG4"] = 9] = "MPEG4";
    FlvVideoCodec[FlvVideoCodec["VP9"] = 8] = "VP9";
    FlvVideoCodec[FlvVideoCodec["SPEEX"] = 11] = "SPEEX";
    FlvVideoCodec[FlvVideoCodec["H265"] = 12] = "H265";
    FlvVideoCodec[FlvVideoCodec["AV1"] = 13] = "AV1";
    FlvVideoCodec[FlvVideoCodec["HEVC"] = 15] = "HEVC";
    FlvVideoCodec[FlvVideoCodec["MPEG2TS"] = 16] = "MPEG2TS";
})(FlvVideoCodec || (exports.FlvVideoCodec = FlvVideoCodec = {}));
var FlvAudioCodec;
(function (FlvAudioCodec) {
    FlvAudioCodec[FlvAudioCodec["PCM"] = 0] = "PCM";
    FlvAudioCodec[FlvAudioCodec["ADPCM"] = 1] = "ADPCM";
    FlvAudioCodec[FlvAudioCodec["MP3"] = 2] = "MP3";
    FlvAudioCodec[FlvAudioCodec["PCM_LE"] = 3] = "PCM_LE";
    FlvAudioCodec[FlvAudioCodec["NELLYMOSER_16KHZ_MONO"] = 4] = "NELLYMOSER_16KHZ_MONO";
    FlvAudioCodec[FlvAudioCodec["NELLYMOSER_8KHZ_MONO"] = 5] = "NELLYMOSER_8KHZ_MONO";
    FlvAudioCodec[FlvAudioCodec["NELLYMOSER"] = 6] = "NELLYMOSER";
    FlvAudioCodec[FlvAudioCodec["PCM_ALAW"] = 7] = "PCM_ALAW";
    FlvAudioCodec[FlvAudioCodec["PCM_MULAW"] = 8] = "PCM_MULAW";
    FlvAudioCodec[FlvAudioCodec["ExHeader"] = 9] = "ExHeader";
    FlvAudioCodec[FlvAudioCodec["AAC"] = 10] = "AAC";
    FlvAudioCodec[FlvAudioCodec["AAC_LATM"] = 13] = "AAC_LATM";
})(FlvAudioCodec || (exports.FlvAudioCodec = FlvAudioCodec = {}));
class FOURCC {
}
FOURCC.AV1 = node_buffer_1.Buffer.from('av01');
FOURCC.VP9 = node_buffer_1.Buffer.from('vp09');
FOURCC.HEVC = node_buffer_1.Buffer.from('hvc1');
FOURCC.AC3 = node_buffer_1.Buffer.from('ac-3');
FOURCC.EAC3 = node_buffer_1.Buffer.from('ec-3');
FOURCC.OPUS = node_buffer_1.Buffer.from('Opus');
FOURCC.MP3 = node_buffer_1.Buffer.from('.mp3');
FOURCC.FLAC = node_buffer_1.Buffer.from('fLaC');
FOURCC.AAC = node_buffer_1.Buffer.from('mp4a');
var VideoPacketType;
(function (VideoPacketType) {
    VideoPacketType[VideoPacketType["SequenceStart"] = 0] = "SequenceStart";
    VideoPacketType[VideoPacketType["AvcSequenceHeader"] = 0] = "AvcSequenceHeader";
    VideoPacketType[VideoPacketType["CodedFrames"] = 1] = "CodedFrames";
    VideoPacketType[VideoPacketType["SequenceEnd"] = 2] = "SequenceEnd";
    VideoPacketType[VideoPacketType["CodedFramesX"] = 3] = "CodedFramesX";
    VideoPacketType[VideoPacketType["Metadata"] = 4] = "Metadata";
    VideoPacketType[VideoPacketType["MPEG2TSSequenceStart"] = 5] = "MPEG2TSSequenceStart";
})(VideoPacketType || (VideoPacketType = {}));
var AudioPacketType;
(function (AudioPacketType) {
    AudioPacketType[AudioPacketType["SequenceStart"] = 0] = "SequenceStart";
    AudioPacketType[AudioPacketType["CodedFrames"] = 1] = "CodedFrames";
    AudioPacketType[AudioPacketType["SequenceEnd"] = 2] = "SequenceEnd";
    AudioPacketType[AudioPacketType["MultichannelConfig"] = 4] = "MultichannelConfig";
    AudioPacketType[AudioPacketType["Multitrack"] = 5] = "Multitrack";
    AudioPacketType[AudioPacketType["TypModEx"] = 7] = "TypModEx";
})(AudioPacketType || (AudioPacketType = {}));
class Flv {
    constructor() {
        this.onPacketCallback = (avpacket) => {
        };
        this.parserData = (buffer) => {
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
                            this.parserTagTime = (this.parserBuffer[4] << 16) | (this.parserBuffer[5] << 8) | this.parserBuffer[6] | (this.parserBuffer[7] << 24);
                            logger_js_1.default.debug(`parser tag type=${this.parserTagType} time=${this.parserTagTime} size=${this.parserTagSize} `);
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
                                let packet = Flv.parserTag(this.parserTagType, this.parserTagTime, this.parserTagSize, this.parserTagData);
                                this.onPacketCallback(packet);
                            }
                            else {
                                return 'flv tag parser error';
                            }
                        }
                        break;
                }
            }
            return null;
        };
        this.parserTagAlloc = (size) => {
            if (this.parserTagCapacity < size) {
                this.parserTagCapacity = size * 2;
                const newBuffer = node_buffer_1.Buffer.alloc(this.parserTagCapacity);
                this.parserTagData.copy(newBuffer);
                this.parserTagData = newBuffer;
            }
        };
        this.parserBuffer = node_buffer_1.Buffer.alloc(13);
        this.parserState = FlvParserState.INIT;
        this.parserHeaderBytes = 0;
        this.parserTagBytes = 0;
        this.parserTagType = 0;
        this.parserTagSize = 0;
        this.parserTagTime = 0;
        this.parserTagCapacity = 1024 * 1024;
        this.parserTagData = node_buffer_1.Buffer.alloc(this.parserTagCapacity);
        this.parserPreviousBytes = 0;
    }
}
Flv.createHeader = (hasAudio, hasVideo) => {
    const buffer = node_buffer_1.Buffer.from([0x46, 0x4c, 0x56, 0x01, 0x00, 0x00, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00, 0x00]);
    if (hasAudio) {
        buffer[4] |= 4;
    }
    if (hasVideo) {
        buffer[4] |= 1;
    }
    return buffer;
};
Flv.createMessage = (avpacket) => {
    const buffer = node_buffer_1.Buffer.alloc(11 + avpacket.size + 4);
    buffer[0] = avpacket.codec_type;
    buffer.writeUintBE(avpacket.size, 1, 3);
    buffer[4] = (avpacket.dts >> 16) & 0xFF;
    buffer[5] = (avpacket.dts >> 8) & 0xFF;
    buffer[6] = avpacket.dts & 0xFF;
    buffer[7] = (avpacket.dts >> 24) & 0xFF;
    avpacket.data.copy(buffer, 11, 0, avpacket.size);
    buffer.writeUint32BE(11 + avpacket.size, 11 + avpacket.size);
    return buffer;
};
Flv.parserTag = (type, time, size, data) => {
    let packet = new AVPacket_js_1.default();
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
        }
        else {
            const audioPacketType = data[0] & 0x0f;
            if (audioPacketType === AudioPacketType.SequenceStart) {
                packet.flags = 0;
            }
        }
    }
    else if (type === FlvMediaType.VIDEO) {
        const frameType = data[0] >> 4 & 0b0111;
        const codecID = data[0] & 0x0f;
        const isExHeader = (data[0] >> 4 & 0b1000) !== 0;
        if (isExHeader) {
            const videoPacketType = data[0] & 0x0f;
            const fourCC = data.subarray(1, 5);
            if (fourCC.compare(FOURCC.AV1) === 0 || fourCC.compare(FOURCC.VP9) === 0 || fourCC.compare(FOURCC.HEVC) === 0) {
                packet.codec_id = fourCC.readUint32BE();
                if (videoPacketType === VideoPacketType.SequenceStart) {
                    packet.flags = 2;
                }
                else if (videoPacketType === VideoPacketType.CodedFrames || videoPacketType === VideoPacketType.CodedFramesX) {
                    if (frameType === FlvFrameType.KEY) {
                        packet.flags = 3;
                    }
                    else {
                        packet.flags = 4;
                    }
                }
                else if (videoPacketType === VideoPacketType.Metadata) {
                    packet.flags = 6;
                }
                if (fourCC.compare(FOURCC.HEVC) === 0) {
                    if (videoPacketType === VideoPacketType.CodedFrames) {
                        const cts = data.readUintBE(5, 3);
                        packet.pts = packet.dts + cts;
                    }
                }
            }
        }
        else {
            const cts = data.readUintBE(2, 3);
            const videoPacketType = data[1];
            packet.codec_id = codecID;
            packet.pts = packet.dts + cts;
            packet.flags = 4;
            if (codecID === FlvVideoCodec.H264) {
                if (videoPacketType === VideoPacketType.AvcSequenceHeader) {
                    packet.flags = 2;
                }
                else {
                    if (frameType === FlvFrameType.KEY) {
                        packet.flags = 3;
                    }
                    else {
                        packet.flags = 4;
                    }
                }
            }
        }
    }
    else if (type === FlvMediaType.SCRIPT) {
        packet.flags = 5;
    }
    return packet;
};
exports.default = Flv;
