"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeSession = void 0;
const lodash_1 = __importDefault(require("lodash"));
const events_1 = __importDefault(require("events"));
const node_core_utils_1 = __importDefault(require("./node_core_utils"));
class NodeSession extends events_1.default {
    constructor(conf, remoteIp, tag) {
        super();
        this.id = null;
        this.conf = lodash_1.default.cloneDeep(conf);
        this.id = node_core_utils_1.default.generateNewSessionID();
        this.remoteIp = remoteIp;
        this.TAG = tag;
    }
    getConfig(key = null) {
        if (!key)
            return;
        if (typeof this.conf != 'object')
            return;
        if (this.conf.args && typeof this.conf.args === 'object' && this.conf.args[key])
            return this.conf.args[key];
        return this.conf[key];
    }
    isLocal() {
        return this.remoteIp === '127.0.0.1'
            || this.remoteIp === '::1'
            || this.remoteIp === '::ffff:127.0.0.1';
    }
}
exports.NodeSession = NodeSession;
