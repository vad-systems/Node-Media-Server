"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwitchSession = void 0;
const nms_server_1 = require("../../server");
class SwitchSession extends nms_server_1.BaseAvSession {
    constructor(conf) {
        super(conf, '127.0.0.1', nms_server_1.Protocol.RTMP);
        this.streamPath = conf.streamPath;
        this.streamApp = conf.app;
        this.streamName = conf.name;
        this.streamQuery = conf.args || {};
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
