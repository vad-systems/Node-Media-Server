"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeFfmpegSession = void 0;
const child_process_1 = require("child_process");
const node_buffer_1 = require("node:buffer");
const nms_core_1 = require("../../core");
const nms_shared_1 = require("../../shared");
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
    start(argv) {
        super.start();
        let argumentList = argv.filter(Boolean);
        this.ffmpeg_exec = (0, child_process_1.spawn)(this.conf.ffmpeg, argumentList);
        this.startTime = Date.now();
        this.state = nms_shared_1.SessionState.RUNNING;
        nms_core_1.context.idlePlayers.delete(this.id);
        this.ffmpeg_exec.on('error', (e) => {
            this.logger.ffdebug(`[ffmpeg] error: ${e}`);
        });
        this.ffmpeg_exec.stdout.on('data', (data) => {
            this.logger.ffdebug(`[ffmpeg] stdout: ${data}`);
        });
        this.ffmpeg_exec.stderr.on('data', (data) => {
            this.logger.ffdebug(`[ffmpeg] stderr: ${data}`);
        });
        this.ffmpeg_exec.on('close', (code) => {
            this.logger.log(`[ffmpeg] closed: code=${code}`);
            this.ffmpeg_exec = null;
            this.emit('end', this.id);
            this.didStop();
            if (!this.isManualStop) {
                this.cleanup();
            }
        });
    }
    end() {
        this.logger.log(`[ffmpeg] kill SIGTERM: id=${this.id}`);
        if (this.ffmpeg_exec) {
            if (!this.ffmpeg_exec.kill("SIGTERM")) {
                this.logger.warn(`[ffmpeg] kill SIGKILL: id=${this.id}`);
                this.ffmpeg_exec.kill("SIGKILL");
            }
        }
        else {
            this.logger.warn(`[ffmpeg] already terminated or never started: id=${this.id}`);
            this.emit('end', this.id);
            this.didStop();
            if (!this.isManualStop) {
                this.cleanup();
            }
        }
    }
    stop(manual = false) {
        if (this.state === nms_shared_1.SessionState.STOPPED || this.state === nms_shared_1.SessionState.STOPPING) {
            return;
        }
        this.logger.log(`[ffmpeg] session stop: id=${this.id} manual=${manual}`);
        super.stop(manual);
        this.endTime = Date.now();
        this.end();
    }
    sendBuffer(buffer) {
        if (node_buffer_1.Buffer.isBuffer(buffer)) {
            this.outBytes += buffer.length;
        }
    }
}
exports.NodeFfmpegSession = NodeFfmpegSession;
