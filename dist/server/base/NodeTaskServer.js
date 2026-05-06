"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeTaskServer = void 0;
const lodash_1 = __importDefault(require("lodash"));
const nms_core_1 = require("../../core");
const NodeConfigurableServer_js_1 = require("./NodeConfigurableServer.js");
class NodeTaskServer extends NodeConfigurableServer_js_1.NodeConfigurableServer {
    constructor() {
        super();
        this.onPostPublish = this.onPostPublish.bind(this);
        this.onDonePublish = this.onDonePublish.bind(this);
    }
    async run() {
        await super.run();
        nms_core_1.context.nodeEvent.on('postPublish', this.onPostPublish);
        nms_core_1.context.nodeEvent.on('donePublish', this.onDonePublish);
    }
    stop() {
        super.stop();
        nms_core_1.context.nodeEvent.off('postPublish', this.onPostPublish);
        nms_core_1.context.nodeEvent.off('donePublish', this.onDonePublish);
    }
    onPostPublish(session) {
        if (session.streamPath) {
            const regRes = /\/(.*)\/(.*)/i.exec(session.streamPath);
            if (regRes) {
                const [app, name] = lodash_1.default.slice(regRes, 1);
                this.handleTaskMatching(session, app, name);
            }
        }
    }
    onDonePublish(session) {
        // BroadcastServer handles automatic cleanup of task-subscribers in donePublish.
        // Subclasses can implement extra cleanup logic if necessary.
    }
}
exports.NodeTaskServer = NodeTaskServer;
