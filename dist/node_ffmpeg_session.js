"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeFfmpegSession = void 0;
const child_process_1 = require("child_process");
const node_session_1 = require("./node_session");
const node_core_logger_1 = require("./node_core_logger");
class NodeFfmpegSession extends node_session_1.NodeSession {
    constructor(conf, remoteIp, tag) {
        super(conf, remoteIp, tag);
        this.ffmpeg_exec = null;
    }
    run(argv) {
        let argumentList = argv.filter(Boolean);
        this.ffmpeg_exec = (0, child_process_1.spawn)(this.conf.ffmpeg, argumentList);
        this.ffmpeg_exec.on('error', (e) => {
            node_core_logger_1.Logger.ffdebug(`[ffmpeg error] ${this.id}: ${e}`);
        });
        this.ffmpeg_exec.stdout.on('data', (data) => {
            node_core_logger_1.Logger.ffdebug(`[ffmpeg stdout] ${this.id}: ${data}`);
        });
        this.ffmpeg_exec.stderr.on('data', (data) => {
            node_core_logger_1.Logger.ffdebug(`[ffmpeg stderr] ${this.id}: ${data}`);
        });
        this.ffmpeg_exec.on('close', (code) => {
            node_core_logger_1.Logger.log(`[ffmpeg end] ${this.id}`);
            this.emit('end', this.id);
        });
    }
    end() {
        this.ffmpeg_exec.kill();
    }
    stop() {
        this.end();
    }
}
exports.NodeFfmpegSession = NodeFfmpegSession;
