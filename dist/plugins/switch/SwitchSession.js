"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwitchSession = void 0;
const nms_server_1 = require("../../server");
class SwitchSession extends nms_server_1.BaseAvSession {
    constructor(conf, streamPath) {
        super(conf, '127.0.0.1', nms_server_1.Protocol.RTMP);
        this.streamPath = streamPath;
        const regRes = /\/(.*)\/(.*)/i.exec(streamPath);
        if (regRes) {
            this.streamApp = regRes[1];
            this.streamName = regRes[2];
        }
        this.isPublisher = true;
        this.isStop = true;
    }
    stop() {
        this.isStop = true;
        this.onClose();
    }
    sendBuffer(buffer) {
        // Virtual session, nowhere to send
    }
}
exports.SwitchSession = SwitchSession;
