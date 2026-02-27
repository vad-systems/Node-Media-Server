"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_buffer_1 = require("node:buffer");
const node_crypto_1 = __importDefault(require("node:crypto"));
const querystring_1 = __importDefault(require("querystring"));
const logger_js_1 = require("../logger.js");
const AMF = __importStar(require("./amf.js"));
const flv_js_1 = __importDefault(require("./flv.js"));
const logger = logger_js_1.LoggerFactory.getLogger('RTMP Protocol');
const RTMP_HANDSHAKE_SIZE = 1536;
var RtmpHandshakeState;
(function (RtmpHandshakeState) {
    RtmpHandshakeState[RtmpHandshakeState["UNINIT"] = 0] = "UNINIT";
    RtmpHandshakeState[RtmpHandshakeState["HANDSHAKE_0"] = 1] = "HANDSHAKE_0";
    RtmpHandshakeState[RtmpHandshakeState["HANDSHAKE_1"] = 2] = "HANDSHAKE_1";
    RtmpHandshakeState[RtmpHandshakeState["HANDSHAKE_2"] = 3] = "HANDSHAKE_2";
})(RtmpHandshakeState || (RtmpHandshakeState = {}));
var RtmpParserState;
(function (RtmpParserState) {
    RtmpParserState[RtmpParserState["INIT"] = 0] = "INIT";
    RtmpParserState[RtmpParserState["BASIC_HEADER"] = 1] = "BASIC_HEADER";
    RtmpParserState[RtmpParserState["MESSAGE_HEADER"] = 2] = "MESSAGE_HEADER";
    RtmpParserState[RtmpParserState["EXTENDED_TIMESTAMP"] = 3] = "EXTENDED_TIMESTAMP";
    RtmpParserState[RtmpParserState["PAYLOAD"] = 4] = "PAYLOAD";
})(RtmpParserState || (RtmpParserState = {}));
const MAX_CHUNK_HEADER = 18;
var RtmpChunk;
(function (RtmpChunk) {
    RtmpChunk[RtmpChunk["TYPE_0"] = 0] = "TYPE_0";
    RtmpChunk[RtmpChunk["TYPE_1"] = 1] = "TYPE_1";
    RtmpChunk[RtmpChunk["TYPE_2"] = 2] = "TYPE_2";
    RtmpChunk[RtmpChunk["TYPE_3"] = 3] = "TYPE_3";
})(RtmpChunk || (RtmpChunk = {}));
var RtmpChannel;
(function (RtmpChannel) {
    RtmpChannel[RtmpChannel["PROTOCOL"] = 2] = "PROTOCOL";
    RtmpChannel[RtmpChannel["INVOKE"] = 3] = "INVOKE";
    RtmpChannel[RtmpChannel["AUDIO"] = 4] = "AUDIO";
    RtmpChannel[RtmpChannel["VIDEO"] = 5] = "VIDEO";
    RtmpChannel[RtmpChannel["DATA"] = 6] = "DATA";
})(RtmpChannel || (RtmpChannel = {}));
const rtmpHeaderSize = [11, 7, 3, 0];
var RtmpType;
(function (RtmpType) {
    RtmpType[RtmpType["NONE"] = 0] = "NONE";
    /* Protocol Control Messages */
    RtmpType[RtmpType["SET_CHUNK_SIZE"] = 1] = "SET_CHUNK_SIZE";
    RtmpType[RtmpType["ABORT"] = 2] = "ABORT";
    RtmpType[RtmpType["ACKNOWLEDGEMENT"] = 3] = "ACKNOWLEDGEMENT";
    RtmpType[RtmpType["WINDOW_ACKNOWLEDGEMENT_SIZE"] = 5] = "WINDOW_ACKNOWLEDGEMENT_SIZE";
    RtmpType[RtmpType["SET_PEER_BANDWIDTH"] = 6] = "SET_PEER_BANDWIDTH";
    /* User Control Messages Event (4) */
    RtmpType[RtmpType["EVENT"] = 4] = "EVENT";
    RtmpType[RtmpType["AUDIO"] = 8] = "AUDIO";
    RtmpType[RtmpType["VIDEO"] = 9] = "VIDEO";
    /* Data Message */
    RtmpType[RtmpType["FLEX_STREAM"] = 15] = "FLEX_STREAM";
    RtmpType[RtmpType["DATA"] = 18] = "DATA";
    /* Shared Object Message */
    RtmpType[RtmpType["FLEX_OBJECT"] = 16] = "FLEX_OBJECT";
    RtmpType[RtmpType["SHARED_OBJECT"] = 19] = "SHARED_OBJECT";
    /* Command Message */
    RtmpType[RtmpType["FLEX_MESSAGE"] = 17] = "FLEX_MESSAGE";
    RtmpType[RtmpType["INVOKE"] = 20] = "INVOKE";
    /* Aggregate Message */
    RtmpType[RtmpType["METADATA"] = 22] = "METADATA";
})(RtmpType || (RtmpType = {}));
const RTMP_CHUNK_SIZE = 128;
const RTMP_MAX_CHUNK_SIZE = 0xffff;
const RTMP_PING_TIME = 60000;
const RTMP_PING_TIMEOUT = 30000;
var StreamStatus;
(function (StreamStatus) {
    StreamStatus[StreamStatus["BEGIN"] = 0] = "BEGIN";
    StreamStatus[StreamStatus["EOF"] = 1] = "EOF";
    StreamStatus[StreamStatus["DRY"] = 2] = "DRY";
    StreamStatus[StreamStatus["EMPTY"] = 31] = "EMPTY";
    StreamStatus[StreamStatus["READY"] = 32] = "READY";
})(StreamStatus || (StreamStatus = {}));
var MessageFormat;
(function (MessageFormat) {
    MessageFormat[MessageFormat["FORMAT_0"] = 0] = "FORMAT_0";
    MessageFormat[MessageFormat["FORMAT_1"] = 1] = "FORMAT_1";
    MessageFormat[MessageFormat["FORMAT_2"] = 2] = "FORMAT_2";
})(MessageFormat || (MessageFormat = {}));
const RTMP_SIG_SIZE = 1536;
const SHA256DL = 32;
const RandomCrud = node_buffer_1.Buffer.from([
    0xf0, 0xee, 0xc2, 0x4a, 0x80, 0x68, 0xbe, 0xe8,
    0x2e, 0x00, 0xd0, 0xd1, 0x02, 0x9e, 0x7e, 0x57,
    0x6e, 0xec, 0x5d, 0x2d, 0x29, 0x80, 0x6f, 0xab,
    0x93, 0xb8, 0xe6, 0x36, 0xcf, 0xeb, 0x31, 0xae,
]);
const GenuineFMSConst = 'Genuine Adobe Flash Media Server 001';
const GenuineFMSConstCrud = node_buffer_1.Buffer.concat([node_buffer_1.Buffer.from(GenuineFMSConst, 'utf8'), RandomCrud]);
const GenuineFPConst = 'Genuine Adobe Flash Player 001';
const GenuineFPConstCrud = node_buffer_1.Buffer.concat([node_buffer_1.Buffer.from(GenuineFPConst, 'utf8'), RandomCrud]);
function calcHmac(data, key) {
    let hmac = node_crypto_1.default.createHmac('sha256', key);
    hmac.update(data);
    return hmac.digest();
}
function GetClientGenuineConstDigestOffset(buf) {
    let offset = buf[0] + buf[1] + buf[2] + buf[3];
    offset = (offset % 728) + 12;
    return offset;
}
function GetServerGenuineConstDigestOffset(buf) {
    let offset = buf[0] + buf[1] + buf[2] + buf[3];
    offset = (offset % 728) + 776;
    return offset;
}
function detectClientMessageFormat(clientsig) {
    let sdl = GetServerGenuineConstDigestOffset(clientsig.slice(772, 776));
    let msg = node_buffer_1.Buffer.concat([clientsig.slice(0, sdl), clientsig.slice(sdl + SHA256DL)], 1504);
    let computedSignature = calcHmac(msg, GenuineFPConst);
    let providedSignature = clientsig.slice(sdl, sdl + SHA256DL);
    if (computedSignature.equals(providedSignature)) {
        return MessageFormat.FORMAT_2;
    }
    sdl = GetClientGenuineConstDigestOffset(clientsig.slice(8, 12));
    msg = node_buffer_1.Buffer.concat([clientsig.slice(0, sdl), clientsig.slice(sdl + SHA256DL)], 1504);
    computedSignature = calcHmac(msg, GenuineFPConst);
    providedSignature = clientsig.slice(sdl, sdl + SHA256DL);
    if (computedSignature.equals(providedSignature)) {
        return MessageFormat.FORMAT_1;
    }
    return MessageFormat.FORMAT_0;
}
function generateS1(messageFormat) {
    let randomBytes = node_crypto_1.default.randomBytes(RTMP_SIG_SIZE - 8);
    let handshakeBytes = node_buffer_1.Buffer.concat([node_buffer_1.Buffer.from([0, 0, 0, 0, 1, 2, 3, 4]), randomBytes], RTMP_SIG_SIZE);
    let serverDigestOffset;
    if (messageFormat === 1) {
        serverDigestOffset = GetClientGenuineConstDigestOffset(handshakeBytes.slice(8, 12));
    }
    else {
        serverDigestOffset = GetServerGenuineConstDigestOffset(handshakeBytes.slice(772, 776));
    }
    let msg = node_buffer_1.Buffer.concat([
        handshakeBytes.slice(0, serverDigestOffset),
        handshakeBytes.slice(serverDigestOffset + SHA256DL),
    ], RTMP_SIG_SIZE - SHA256DL);
    let hash = calcHmac(msg, GenuineFMSConst);
    hash.copy(handshakeBytes, serverDigestOffset, 0, 32);
    return handshakeBytes;
}
function generateS2(messageFormat, clientsig) {
    let randomBytes = node_crypto_1.default.randomBytes(RTMP_SIG_SIZE - 32);
    let challengeKeyOffset;
    if (messageFormat === 1) {
        challengeKeyOffset = GetClientGenuineConstDigestOffset(clientsig.slice(8, 12));
    }
    else {
        challengeKeyOffset = GetServerGenuineConstDigestOffset(clientsig.slice(772, 776));
    }
    let challengeKey = clientsig.slice(challengeKeyOffset, challengeKeyOffset + 32);
    let hash = calcHmac(challengeKey, GenuineFMSConstCrud);
    let signature = calcHmac(randomBytes, hash);
    return node_buffer_1.Buffer.concat([randomBytes, signature], RTMP_SIG_SIZE);
}
function generateS0S1S2(clientsig) {
    let clientType = node_buffer_1.Buffer.alloc(1, 3);
    let messageFormat = detectClientMessageFormat(clientsig);
    let allBytes;
    if (messageFormat === MessageFormat.FORMAT_0) {
        //    logger.debug('[rtmp handshake] using simple handshake.');
        allBytes = node_buffer_1.Buffer.concat([clientType, clientsig, clientsig]);
    }
    else {
        //    logger.debug('[rtmp handshake] using complex handshake.');
        allBytes = node_buffer_1.Buffer.concat([clientType, generateS1(messageFormat), generateS2(messageFormat, clientsig)]);
    }
    return allBytes;
}
class RtmpPacket {
    constructor(fmt = 0, cid = 0) {
        this._header = {
            fmt: fmt,
            cid: cid,
            timestamp: 0,
            length: 0,
            type: RtmpType.NONE,
            stream_id: 0,
        };
        this._clock = 0;
        this._payload = node_buffer_1.Buffer.alloc(0);
        this._capacity = 0;
        this._bytes = 0;
    }
    get header() {
        return this._header;
    }
    set header(value) {
        this._header = value;
    }
    get clock() {
        return this._clock;
    }
    set clock(value) {
        this._clock = value;
    }
    get payload() {
        return this._payload;
    }
    set payload(value) {
        this._payload = value;
    }
    get capacity() {
        return this._capacity;
    }
    set capacity(value) {
        this._capacity = value;
    }
    get bytes() {
        return this._bytes;
    }
    set bytes(value) {
        this._bytes = value;
    }
}
class Rtmp {
    constructor() {
        this.handshakePayload = node_buffer_1.Buffer.alloc(RTMP_HANDSHAKE_SIZE);
        this.handshakeState = RtmpHandshakeState.UNINIT;
        this.handshakeBytes = 0;
        this.parserBuffer = node_buffer_1.Buffer.alloc(MAX_CHUNK_HEADER);
        this.parserState = RtmpParserState.INIT;
        this.parserBytes = 0;
        this.parserBasicBytes = 0;
        this.parserPacket = null;
        this.inPackets = new Map();
        this.inChunkSize = RTMP_CHUNK_SIZE;
        this.streamApp = '';
        this.streamName = '';
        this.streamHost = '';
        this.streams = 0;
        this.streamId = 0;
        this.onConnectCallback = (req) => {
        };
        this.onPlayCallback = () => {
        };
        this.onPushCallback = () => {
        };
        this.onPacketCallback = (avpacket) => {
        };
        this.onOutputCallback = (buffer) => {
        };
        this.packetParse = () => {
            var _a;
            let fmt = this.parserBuffer[0] >> 6;
            let cid = 0;
            if (this.parserBasicBytes === 2) {
                cid = 64 + this.parserBuffer[1];
            }
            else if (this.parserBasicBytes === 3) {
                cid = (64 + this.parserBuffer[1] + this.parserBuffer[2]) << 8;
            }
            else {
                cid = this.parserBuffer[0] & 0x3f;
            }
            this.parserPacket = (_a = this.inPackets.get(cid)) !== null && _a !== void 0 ? _a : new RtmpPacket(fmt, cid);
            this.inPackets.set(cid, this.parserPacket);
            this.parserPacket.header.fmt = fmt;
            this.parserPacket.header.cid = cid;
            this.chunkMessageHeaderRead();
        };
        this.chunkMessageHeaderRead = () => {
            let offset = this.parserBasicBytes;
            // timestamp / delta
            if (this.parserPacket.header.fmt <= RtmpChunk.TYPE_2) {
                this.parserPacket.header.timestamp = this.parserBuffer.readUIntBE(offset, 3);
                offset += 3;
            }
            // message length + type
            if (this.parserPacket.header.fmt <= RtmpChunk.TYPE_1) {
                this.parserPacket.header.length = this.parserBuffer.readUIntBE(offset, 3);
                this.parserPacket.header.type = this.parserBuffer[offset + 3];
                offset += 4;
            }
            if (this.parserPacket.header.fmt === RtmpChunk.TYPE_0) {
                this.parserPacket.header.stream_id = this.parserBuffer.readUInt32LE(offset);
                offset += 4;
            }
            return offset;
        };
        this.packetAlloc = () => {
            if (this.parserPacket.capacity < this.parserPacket.header.length) {
                this.parserPacket.payload = node_buffer_1.Buffer.alloc(this.parserPacket.header.length + 1024);
                this.parserPacket.capacity = this.parserPacket.header.length + 1024;
            }
        };
        this.packetHandler = () => {
            switch (this.parserPacket.header.type) {
                case RtmpType.SET_CHUNK_SIZE:
                case RtmpType.ABORT:
                case RtmpType.ACKNOWLEDGEMENT:
                case RtmpType.WINDOW_ACKNOWLEDGEMENT_SIZE:
                case RtmpType.SET_PEER_BANDWIDTH:
                    return this.controlHandler();
                case RtmpType.EVENT:
                    return this.eventHandler();
                case RtmpType.FLEX_MESSAGE:
                case RtmpType.INVOKE:
                    return this.invokeHandler();
                case RtmpType.AUDIO:
                case RtmpType.VIDEO:
                case RtmpType.FLEX_STREAM: // AMF3
                case RtmpType.DATA: // AMF0
                    return this.dataHandler();
            }
        };
        this.controlHandler = () => {
            let payload = this.parserPacket.payload;
            switch (this.parserPacket.header.type) {
                case RtmpType.SET_CHUNK_SIZE:
                    this.inChunkSize = payload.readUInt32BE();
                    // logger.debug('set inChunkSize', this.inChunkSize);
                    break;
                case RtmpType.ABORT:
                    break;
                case RtmpType.ACKNOWLEDGEMENT:
                    break;
                case RtmpType.WINDOW_ACKNOWLEDGEMENT_SIZE:
                    this.ackSize = payload.readUInt32BE();
                    // logger.debug('set ack Size', this.ackSize);
                    break;
                case RtmpType.SET_PEER_BANDWIDTH:
                    break;
            }
        };
        this.eventHandler = () => {
        };
        this.dataHandler = () => {
            let packet = flv_js_1.default.parserTag(this.parserPacket.header.type, this.parserPacket.clock, this.parserPacket.header.length, this.parserPacket.payload);
            this.onPacketCallback(packet);
        };
        this.onConnect = (invokeMessage) => {
            const url = new URL(invokeMessage.cmdObj.tcUrl);
            this.connectCmdObj = invokeMessage.cmdObj;
            this.streamApp = invokeMessage.cmdObj.app;
            this.streamHost = url.hostname;
            this.objectEncoding = invokeMessage.cmdObj.objectEncoding != null ? invokeMessage.cmdObj.objectEncoding : 0;
            this.connectTime = new Date(); // TODO: Pass through as startTime
            this.startTimestamp = Date.now();
            this.sendWindowACK(5000000);
            this.setPeerBandwidth(5000000, 2);
            this.setChunkSize(this.outChunkSize);
            this.respondConnect(invokeMessage.transId);
        };
        this.onCreateStream = (invokeMessage) => {
            this.respondCreateStream(invokeMessage.transId);
        };
        this.onPublish = (invokeMessage) => {
            this.streamName = invokeMessage.streamName.split('?')[0];
            this.streamQuery = querystring_1.default.parse(invokeMessage.streamName.split('?')[1]);
            this.streamId = this.parserPacket.header.stream_id;
            this.respondPublish();
            this.onConnectCallback({
                app: this.streamApp,
                name: this.streamName,
                host: this.streamHost,
                query: this.streamQuery,
            });
            this.onPushCallback();
        };
        this.onPlay = (invokeMessage) => {
            this.streamName = invokeMessage.streamName.split('?')[0];
            this.streamQuery = querystring_1.default.parse(invokeMessage.streamName.split('?')[1]);
            this.streamId = this.parserPacket.header.stream_id;
            this.respondPlay();
            this.onConnectCallback({
                app: this.streamApp,
                name: this.streamName,
                host: this.streamHost,
                query: this.streamQuery,
            });
            this.onPlayCallback();
        };
        this.onDeleteStream = (invokeMessage) => {
        };
        this.sendACK = (size) => {
            let rtmpBuffer = node_buffer_1.Buffer.from('02000000000004030000000000000000', 'hex');
            rtmpBuffer.writeUInt32BE(size, 12);
            this.onOutputCallback(rtmpBuffer);
        };
        this.sendWindowACK = (size) => {
            let rtmpBuffer = node_buffer_1.Buffer.from('02000000000004050000000000000000', 'hex');
            rtmpBuffer.writeUInt32BE(size, 12);
            this.onOutputCallback(rtmpBuffer);
        };
        this.setPeerBandwidth = (size, type) => {
            let rtmpBuffer = node_buffer_1.Buffer.from('0200000000000506000000000000000000', 'hex');
            rtmpBuffer.writeUInt32BE(size, 12);
            rtmpBuffer[16] = type;
            this.onOutputCallback(rtmpBuffer);
        };
        this.setChunkSize = (size) => {
            let rtmpBuffer = node_buffer_1.Buffer.from('02000000000004010000000000000000', 'hex');
            rtmpBuffer.writeUInt32BE(size, 12);
            this.onOutputCallback(rtmpBuffer);
        };
        this.sendStreamStatus = (st, id) => {
            let rtmpBuffer = node_buffer_1.Buffer.from('020000000000060400000000000000000000', 'hex');
            rtmpBuffer.writeUInt16BE(st, 12);
            rtmpBuffer.writeUInt32BE(id, 14);
            this.onOutputCallback(rtmpBuffer);
        };
        this.sendInvokeMessage = (sid, opt) => {
            let packet = new RtmpPacket();
            packet.header.fmt = RtmpChunk.TYPE_0;
            packet.header.cid = RtmpChannel.INVOKE;
            packet.header.type = RtmpType.INVOKE;
            packet.header.stream_id = sid;
            packet.payload = AMF.encodeAmf0Cmd(opt);
            packet.header.length = packet.payload.length;
            let chunks = Rtmp.chunksCreate(packet);
            this.onOutputCallback(chunks);
        };
        this.handshakePayload = node_buffer_1.Buffer.alloc(RTMP_HANDSHAKE_SIZE);
        this.handshakeState = RtmpHandshakeState.UNINIT;
        this.handshakeBytes = 0;
        this.parserBuffer = node_buffer_1.Buffer.alloc(MAX_CHUNK_HEADER);
        this.parserState = RtmpParserState.INIT;
        this.parserBytes = 0;
        this.parserBasicBytes = 0;
        this.parserPacket = new RtmpPacket();
        this.inPackets = new Map();
        this.inChunkSize = RTMP_CHUNK_SIZE;
        this.outChunkSize = RTMP_MAX_CHUNK_SIZE;
        this.streams = 0;
    }
    parserData(buffer) {
        let bytes = buffer.length;
        let p = 0;
        let n = 0;
        while (bytes > 0) {
            switch (this.handshakeState) {
                case RtmpHandshakeState.UNINIT:
                    // logger.log('RTMP_HANDSHAKE_UNINIT');
                    this.handshakeState = RtmpHandshakeState.HANDSHAKE_0;
                    this.handshakeBytes = 0;
                    bytes -= 1;
                    p += 1;
                    break;
                case RtmpHandshakeState.HANDSHAKE_0:
                    // logger.log('RTMP_HANDSHAKE_0');
                    n = RTMP_HANDSHAKE_SIZE - this.handshakeBytes;
                    n = n <= bytes ? n : bytes;
                    buffer.copy(this.handshakePayload, this.handshakeBytes, p, p + n);
                    this.handshakeBytes += n;
                    bytes -= n;
                    p += n;
                    if (this.handshakeBytes === RTMP_HANDSHAKE_SIZE) {
                        this.handshakeState = RtmpHandshakeState.HANDSHAKE_1;
                        this.handshakeBytes = 0;
                        let s0s1s2 = generateS0S1S2(this.handshakePayload);
                        this.onOutputCallback(s0s1s2);
                    }
                    break;
                case RtmpHandshakeState.HANDSHAKE_1:
                    // logger.log('RTMP_HANDSHAKE_1');
                    n = RTMP_HANDSHAKE_SIZE - this.handshakeBytes;
                    n = n <= bytes ? n : bytes;
                    buffer.copy(this.handshakePayload, this.handshakeBytes, p, n);
                    this.handshakeBytes += n;
                    bytes -= n;
                    p += n;
                    if (this.handshakeBytes === RTMP_HANDSHAKE_SIZE) {
                        this.handshakeState = RtmpHandshakeState.HANDSHAKE_2;
                        this.handshakeBytes = 0;
                    }
                    break;
                case RtmpHandshakeState.HANDSHAKE_2:
                default:
                    this.chunkRead(buffer, p, bytes);
                    return;
            }
        }
    }
    chunkRead(data, p, bytes) {
        let size = 0;
        let offset = 0;
        let extended_timestamp = 0;
        while (offset < bytes) {
            switch (this.parserState) {
                case RtmpParserState.INIT:
                    this.parserBytes = 1;
                    this.parserBuffer[0] = data[p + offset++];
                    if (0 === (this.parserBuffer[0] & 0x3f)) {
                        this.parserBasicBytes = 2;
                    }
                    else if (1 === (this.parserBuffer[0] & 0x3f)) {
                        this.parserBasicBytes = 3;
                    }
                    else {
                        this.parserBasicBytes = 1;
                    }
                    this.parserState = RtmpParserState.BASIC_HEADER;
                    break;
                case RtmpParserState.BASIC_HEADER:
                    while (this.parserBytes < this.parserBasicBytes && offset < bytes) {
                        this.parserBuffer[this.parserBytes++] = data[p + offset++];
                    }
                    if (this.parserBytes >= this.parserBasicBytes) {
                        this.parserState = RtmpParserState.MESSAGE_HEADER;
                    }
                    break;
                case RtmpParserState.MESSAGE_HEADER:
                    size = rtmpHeaderSize[this.parserBuffer[0] >> 6] + this.parserBasicBytes;
                    while (this.parserBytes < size && offset < bytes) {
                        this.parserBuffer[this.parserBytes++] = data[p + offset++];
                    }
                    if (this.parserBytes >= size) {
                        this.packetParse();
                        this.parserState = RtmpParserState.EXTENDED_TIMESTAMP;
                    }
                    break;
                case RtmpParserState.EXTENDED_TIMESTAMP:
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
                        }
                        else {
                            extended_timestamp = this.parserPacket.header.timestamp;
                        }
                        if (this.parserPacket.bytes === 0) {
                            if (RtmpChunk.TYPE_0 === this.parserPacket.header.fmt) {
                                this.parserPacket.clock = extended_timestamp;
                            }
                            else {
                                this.parserPacket.clock += extended_timestamp;
                            }
                            this.packetAlloc();
                        }
                        this.parserState = RtmpParserState.PAYLOAD;
                    }
                    break;
                case RtmpParserState.PAYLOAD:
                    size = Math.min(this.inChunkSize - (this.parserPacket.bytes % this.inChunkSize), this.parserPacket.header.length - this.parserPacket.bytes);
                    size = Math.min(size, bytes - offset);
                    if (size > 0) {
                        data.copy(this.parserPacket.payload, this.parserPacket.bytes, p + offset, p + offset + size);
                    }
                    this.parserPacket.bytes += size;
                    offset += size;
                    if (this.parserPacket.bytes >= this.parserPacket.header.length) {
                        this.parserState = RtmpParserState.INIT;
                        this.parserPacket.bytes = 0;
                        if (this.parserPacket.clock > 0xffffffff) {
                            break;
                        }
                        this.packetHandler();
                    }
                    else if (0 === this.parserPacket.bytes % this.inChunkSize) {
                        this.parserState = RtmpParserState.INIT;
                    }
                    break;
            }
        }
    }
    invokeHandler() {
        let offset = this.parserPacket.header.type === RtmpType.FLEX_MESSAGE ? 1 : 0;
        let payload = this.parserPacket.payload.subarray(offset, this.parserPacket.header.length);
        let invokeMessage = AMF.decodeAmf0Cmd(payload);
        switch (invokeMessage.cmd) {
            case 'connect':
                this.onConnect(invokeMessage);
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
            case 'deleteStream':
                this.onDeleteStream(invokeMessage);
                break;
            default:
                logger.debug(`unhandled invoke message ${invokeMessage.cmd}`);
                break;
        }
    }
    sendDataMessage(sid, opt) {
        let packet = new RtmpPacket();
        packet.header.fmt = RtmpChunk.TYPE_0;
        packet.header.cid = RtmpChannel.DATA;
        packet.header.type = RtmpType.DATA;
        packet.payload = AMF.encodeAmf0Data(opt);
        packet.header.length = packet.payload.length;
        packet.header.stream_id = sid;
        let chunks = Rtmp.chunksCreate(packet);
        this.onOutputCallback(chunks);
    }
    sendStatusMessage(sid, level, code, description) {
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
    sendRtmpSampleAccess(sid) {
        let opt = {
            cmd: '|RtmpSampleAccess',
            bool1: false,
            bool2: false,
        };
        this.sendDataMessage(sid, opt);
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
    respondPublish() {
        this.sendStatusMessage(this.streamId, 'status', 'NetStream.Publish.Start', `/${this.streamApp}/${this.streamName} is now published.`);
    }
    respondPlay() {
        this.sendStreamStatus(StreamStatus.BEGIN, this.streamId);
        this.sendStatusMessage(this.streamId, 'status', 'NetStream.Play.Reset', 'Playing and resetting stream.');
        this.sendStatusMessage(this.streamId, 'status', 'NetStream.Play.Start', 'Started playing stream.');
        this.sendRtmpSampleAccess(this.streamId);
    }
}
Rtmp.createMessage = (avpacket) => {
    let rtmpPacket = new RtmpPacket();
    rtmpPacket.header.fmt = MessageFormat.FORMAT_0;
    switch (avpacket.codec_type) {
        case RtmpType.AUDIO:
            rtmpPacket.header.cid = RtmpChannel.AUDIO;
            break;
        case RtmpType.VIDEO:
            rtmpPacket.header.cid = RtmpChannel.VIDEO;
            break;
        case RtmpType.DATA:
            rtmpPacket.header.cid = RtmpChannel.DATA;
            break;
        case RtmpType.EVENT:
            rtmpPacket.header.cid = RtmpChannel.PROTOCOL;
            break;
    }
    rtmpPacket.header.length = avpacket.size;
    rtmpPacket.header.type = avpacket.codec_type;
    rtmpPacket.header.timestamp = avpacket.dts;
    rtmpPacket.clock = avpacket.dts;
    rtmpPacket.payload = avpacket.data;
    return Rtmp.chunksCreate(rtmpPacket);
};
Rtmp.chunkBasicHeaderCreate = (fmt, cid) => {
    let out;
    if (cid >= 64 + 255) {
        out = node_buffer_1.Buffer.alloc(3);
        out[0] = (fmt << 6) | 1;
        out[1] = (cid - 64) & 0xff;
        out[2] = ((cid - 64) >> 8) & 0xff;
    }
    else if (cid >= 64) {
        out = node_buffer_1.Buffer.alloc(2);
        out[0] = (fmt << 6) | 0;
        out[1] = (cid - 64) & 0xff;
    }
    else {
        out = node_buffer_1.Buffer.alloc(1);
        out[0] = (fmt << 6) | cid;
    }
    return out;
};
Rtmp.chunkMessageHeaderCreate = (header) => {
    let out = node_buffer_1.Buffer.alloc(rtmpHeaderSize[header.fmt % 4]);
    if (header.fmt <= RtmpChunk.TYPE_2) {
        out.writeUIntBE(header.timestamp >= 0xffffff ? 0xffffff : header.timestamp, 0, 3);
    }
    if (header.fmt <= RtmpChunk.TYPE_1) {
        out.writeUIntBE(header.length, 3, 3);
        out.writeUInt8(header.type, 6);
    }
    if (header.fmt === RtmpChunk.TYPE_0) {
        out.writeUInt32LE(header.stream_id, 7);
    }
    return out;
};
Rtmp.chunksCreate = (packet) => {
    let header = packet.header;
    let payload = packet.payload;
    let payloadSize = header.length;
    let chunkSize = RTMP_MAX_CHUNK_SIZE;
    let chunksOffset = 0;
    let payloadOffset = 0;
    let chunkBasicHeader = Rtmp.chunkBasicHeaderCreate(header.fmt, header.cid);
    let chunkBasicHeader3 = Rtmp.chunkBasicHeaderCreate(RtmpChunk.TYPE_3, header.cid);
    let chunkMessageHeader = Rtmp.chunkMessageHeaderCreate(header);
    let useExtendedTimestamp = header.timestamp >= 0xffffff;
    let headerSize = chunkBasicHeader.length + chunkMessageHeader.length + (useExtendedTimestamp ? 4 : 0);
    let n = headerSize + payloadSize + Math.floor(payloadSize / chunkSize);
    if (useExtendedTimestamp) {
        n += Math.floor(payloadSize / chunkSize) * 4;
    }
    if (!(payloadSize % chunkSize)) {
        n -= 1;
        if (useExtendedTimestamp) {
            //TODO CHECK
            n -= 4;
        }
    }
    let chunks = node_buffer_1.Buffer.alloc(n);
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
        }
        else {
            payload.copy(chunks, chunksOffset, payloadOffset, payloadOffset + payloadSize);
            payloadSize -= payloadSize;
            chunksOffset += payloadSize;
            payloadOffset += payloadSize;
        }
    }
    return chunks;
};
exports.default = Rtmp;
