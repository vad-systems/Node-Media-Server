"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatus = void 0;
const nms_core_1 = require("../../../core");
const sse_js_1 = require("../../../api/sse.js");
const getStatus = (req, res) => {
    const fetchStatus = () => {
        const staticServer = nms_core_1.context.server.staticServer;
        return staticServer.getStatus();
    };
    if ((0, sse_js_1.isSSERequest)(req)) {
        (0, sse_js_1.streamStats)(req, res, fetchStatus, 2000);
        return;
    }
    res.json(fetchStatus());
};
exports.getStatus = getStatus;
