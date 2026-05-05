"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Protocol = void 0;
var Protocol;
(function (Protocol) {
    Protocol["RTMP"] = "rtmp";
    Protocol["HTTP_FLV"] = "http-flv";
    Protocol["WS_FLV"] = "websocket-flv";
    Protocol["RAW"] = "raw";
})(Protocol || (exports.Protocol = Protocol = {}));
