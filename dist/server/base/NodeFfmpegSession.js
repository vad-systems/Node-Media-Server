"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeFfmpegSession = void 0;
const child_process_1 = require("child_process");
const node_buffer_1 = require("node:buffer");
const nms_core_1 = require("../../core");
const NodeSession_js_1 = require("./NodeSession.js");
class NodeFfmpegSession extends NodeSession_js_1.NodeSession {
    ffmpeg_exec = null;
    constructor(conf, remoteIp, tag) {
        super(conf, remoteIp, tag);
    }
    isFfmpegTask() {
        return true;
    }
    getRtmpInputPath(port, streamPath) {
        return `rtmp://127.0.0.1:${port}${streamPath}`;
    }
    run(argv) {
        let argumentList = argv.filter(Boolean);
        this.ffmpeg_exec = (0, child_process_1.spawn)(this.conf.ffmpeg, argumentList);
        this.startTime = Date.now();
        nms_core_1.context.idlePlayers.delete(this.id);
        this.ffmpeg_exec.on('error', (e) => {
            this.logger.ffdebug(`[ffmpeg error] ${e}`);
        });
        this.ffmpeg_exec.stdout.on('data', (data) => {
            this.logger.ffdebug(`[ffmpeg stdout] ${data}`);
        });
        this.ffmpeg_exec.stderr.on('data', (data) => {
            this.logger.ffdebug(`[ffmpeg stderr] ${data}`);
        });
        this.ffmpeg_exec.on('close', (code) => {
            this.logger.log(`[ffmpeg end] terminated with code`, code);
            this.emit('end', this.id);
            nms_core_1.context.nodeEvent.emit('doneConnect', this);
            this.cleanup();
        });
        nms_core_1.context.nodeEvent.emit('postConnect', this);
    }
    end() {
        this.logger.log("[ffmpeg end] ffmpeg kill:SIGTERM", this.id);
        if (!this.ffmpeg_exec.kill("SIGTERM")) {
            this.logger.warn("[ffmpeg end] ffmpeg kill:SIGKILL", this.id);
            this.ffmpeg_exec.kill("SIGKILL");
        }
    }
    stop() {
        this.logger.log("[ffmpeg stop] session stop", this.id);
        this.isStop = true;
        this.endTime = Date.now();
        this.end();
    }
    restart() {
        this.logger.log("[ffmpeg restart] session restart", this.id);
        this.end();
    }
    sendBuffer(buffer) {
        if (node_buffer_1.Buffer.isBuffer(buffer)) {
            this.outBytes += buffer.length;
        }
    }
}
exports.NodeFfmpegSession = NodeFfmpegSession;
