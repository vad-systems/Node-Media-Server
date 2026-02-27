"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeAvServer = void 0;
const lodash_1 = __importDefault(require("lodash"));
const url_1 = __importDefault(require("url"));
const NodeConfigurableServer_js_1 = __importDefault(require("../NodeConfigurableServer.js"));
const Protocol_js_1 = require("../Protocol.js");
const NodeAvSession_js_1 = require("./NodeAvSession.js");
class NodeAvServer extends NodeConfigurableServer_js_1.default {
    constructor() {
        super();
    }
    handleHttpRequest(req, res) {
        if (!this.isRunning()) {
            res.sendStatus(404);
            return;
        }
        const streamApp = req.params.splat[0];
        const streamName = req.params.splat[1];
        const streamPath = '/' + streamApp + '/' + streamName;
        const streamQuery = req.query;
        const streamHost = req.hostname;
        const isPublisher = req.method === 'POST';
        this.createSession(req, res, {
            streamPath,
            streamQuery,
            streamApp,
            streamName,
            streamHost,
            isPublisher,
        });
    }
    handleWsRequest(req, ws) {
        var _a;
        if (!this.isRunning()) {
            ws.close();
            return;
        }
        const urlInfo = url_1.default.parse(req.url, true);
        const streamHost = (_a = req.headers.host) === null || _a === void 0 ? void 0 : _a.split(':')[0];
        const streamPath = urlInfo.pathname.split('.')[0];
        const streamApp = streamPath.split('/')[1];
        const streamName = streamPath.split('/')[2];
        const streamQuery = urlInfo.query;
        let isPublisher = false;
        if (ws.protocol.toLowerCase() === 'post' || ws.protocol.toLowerCase() === 'publisher') {
            isPublisher = true;
        }
        this.createSession(req, ws, {
            streamPath,
            streamQuery,
            streamApp,
            streamName,
            streamHost,
            isPublisher,
        });
    }
    createSession(req, res, info) {
        const sessionConf = {
            auth: lodash_1.default.cloneDeep(this.config.auth),
        };
        const remoteIp = (req.ip || req.socket.remoteAddress) + ':' + req.socket.remotePort;
        let session = new NodeAvSession_js_1.NodeAvSession(sessionConf, remoteIp, Protocol_js_1.Protocol.FLV, info);
        session.setTransport(req, res);
        session.run();
    }
}
exports.NodeAvServer = NodeAvServer;
