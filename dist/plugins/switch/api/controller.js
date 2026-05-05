"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
    const nms = this.server;
    if (!nms.switchServer) {
        return res.status(503).json({ error: 'Switch server not enabled' });
    }
    const status = nms.switchServer.getStatus();
    res.json(status);
}
exports.default = {
    switchSource,
    getStatus
};
