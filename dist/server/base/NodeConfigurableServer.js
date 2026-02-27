"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeConfigurableServer = void 0;
const nms_core_1 = require("../../core");
class NodeConfigurableServer {
    running;
    config;
    constructor() {
        this.config = nms_core_1.context.configProvider.getConfig();
        this.onConfigChanged = this.onConfigChanged.bind(this);
        nms_core_1.context.nodeEvent.on('configChanged', this.onConfigChanged);
    }
    async onConfigChanged() {
        const newConfig = nms_core_1.context.configProvider.getConfig();
        if (this.running && this.needsRestart(newConfig)) {
            this.stop();
            this.config = newConfig;
            await this.run();
        }
        else {
            this.config = newConfig;
        }
    }
    needsRestart(newConfig) {
        return true;
    }
    isRunning() {
        return this.running;
    }
    async run() {
        this.running = true;
    }
    stop() {
        this.running = false;
    }
}
exports.NodeConfigurableServer = NodeConfigurableServer;
