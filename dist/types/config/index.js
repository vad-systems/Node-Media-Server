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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
__exportStar(require("./relay.js"), exports);
__exportStar(require("./fission.js"), exports);
__exportStar(require("./trans.js"), exports);
__exportStar(require("./http.js"), exports);
__exportStar(require("./rtmp.js"), exports);
class Config {
    constructor(config) {
        this.http = config.http;
        this.https = config.https;
        this.rtmp = config.rtmp;
        this.trans = config.trans;
        this.relay = config.relay;
        this.fission = config.fission;
        this.fission = config.fission;
        this.cluster = config.cluster;
        this.auth = config.auth;
        this.logType = config.logType;
    }
}
exports.Config = Config;
