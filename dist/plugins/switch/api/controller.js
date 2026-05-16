"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sse_js_1 = require("../../../api/sse.js");
function switchSource(req, res) {
    const { path, source } = req.body;
    if (!path || !source) {
        return res.status(400).json({ error: 'path and source are required' });
    }
    const nms = this.server;
    if (!nms.switchServer) {
        return res.status(503).json({ error: 'Switch server not enabled' });
    }
    const result = nms.switchServer.switch(path, source);
    if (result) {
        res.status(202).json({ status: 'Accepted' });
    }
    else {
        res.status(404).json({ error: 'Output path not found or source not valid for this output' });
    }
}
function getStatus(req, res) {
    const fetchStatus = () => {
        const nms = this.server;
        if (!nms.switchServer) {
            throw new Error('Switch server not enabled');
        }
        return nms.switchServer.getStatus();
    };
    if ((0, sse_js_1.isSSERequest)(req)) {
        (0, sse_js_1.streamStats)(req, res, fetchStatus, 2000);
        return;
    }
    try {
        res.json(fetchStatus());
    }
    catch (e) {
        res.status(503).json({ error: e.message });
    }
}
function stopTask(req, res) {
    const { path } = req.body;
    if (!path) {
        return res.status(400).json({ error: 'path is required' });
    }
    const broadcast = this.broadcasts.get(path);
    if (broadcast) {
        broadcast.stop(true);
        res.json({ status: 'ok' });
    }
    else {
        res.status(404).json({ error: 'broadcast not found' });
    }
}
exports.default = {
    switchSource,
    getStatus,
    stopTask
};
