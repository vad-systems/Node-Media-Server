"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatus = void 0;
const nms_core_1 = require("../../../core");
const getStatus = (req, res) => {
    const staticServer = nms_core_1.context.server.staticServer;
    res.json(staticServer.getStatus());
};
exports.getStatus = getStatus;
