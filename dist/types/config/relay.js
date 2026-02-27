"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RtspTransport = exports.RelayMode = void 0;
var RelayMode;
(function (RelayMode) {
    RelayMode["PUSH"] = "push";
    RelayMode["PULL"] = "pull";
})(RelayMode || (exports.RelayMode = RelayMode = {}));
var RtspTransport;
(function (RtspTransport) {
    RtspTransport["UDP"] = "udp";
    RtspTransport["TCP"] = "tcp";
    RtspTransport["UDP_MULTICAST"] = "udp_multicast";
    RtspTransport["HTTP"] = "http";
})(RtspTransport || (exports.RtspTransport = RtspTransport = {}));
