"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeHttpRequest = exports.NodeConnectionType = exports.Mode = exports.RtspTransport = exports.LogType = void 0;
var LogType;
(function (LogType) {
    LogType[LogType["NONE"] = 0] = "NONE";
    LogType[LogType["ERROR"] = 1] = "ERROR";
    LogType[LogType["NORMAL"] = 2] = "NORMAL";
    LogType[LogType["DEBUG"] = 3] = "DEBUG";
    LogType[LogType["FFDEBUG"] = 4] = "FFDEBUG";
})(LogType || (exports.LogType = LogType = {}));
var RtspTransport;
(function (RtspTransport) {
    RtspTransport["UDP"] = "udp";
    RtspTransport["TCP"] = "tcp";
    RtspTransport["UDP_MULTICAST"] = "udp_multicast";
    RtspTransport["HTTP"] = "http";
})(RtspTransport || (exports.RtspTransport = RtspTransport = {}));
var Mode;
(function (Mode) {
    Mode["PUSH"] = "push";
    Mode["PULL"] = "pull";
})(Mode || (exports.Mode = Mode = {}));
var NodeConnectionType;
(function (NodeConnectionType) {
    NodeConnectionType["HTTP"] = "http";
    NodeConnectionType["WS"] = "ws";
})(NodeConnectionType || (exports.NodeConnectionType = NodeConnectionType = {}));
class NodeHttpRequest {
}
exports.NodeHttpRequest = NodeHttpRequest;
