"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const node_fs_1 = require("node:fs");
const context_js_1 = __importDefault(require("../core/context.js"));
class ConfigProvider {
    constructor() {
        this.configLocation = undefined;
        this.config = undefined;
    }
    getConfig() {
        if (!this.isLoaded()) {
            throw new Error('No config provided');
        }
        return this.config;
    }
    isLoaded() {
        return typeof this.config !== typeof undefined;
    }
    setConfigLocation(configLocation) {
        this.configLocation = configLocation;
    }
    setConfig(config) {
        this.config = config;
        context_js_1.default.nodeEvent.emit('configChanged');
    }
    loadConfig() {
        if (typeof this.configLocation === typeof undefined) {
            throw new Error('Cannot load config: Config location is not set');
        }
        const config = (0, fs_1.readFileSync)(this.configLocation, 'utf-8');
        this.config = JSON.parse(config);
        context_js_1.default.nodeEvent.emit('configChanged');
    }
    saveConfig() {
        if (typeof this.configLocation === typeof undefined) {
            throw new Error('Cannot save config: Config location is not set');
        }
        if (typeof this.config === typeof undefined) {
            throw new Error('Cannot save config: Config is not set');
        }
        (0, node_fs_1.writeFileSync)(this.configLocation, JSON.stringify(this.config, undefined, 4));
    }
}
exports.default = ConfigProvider;
