"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeAvServer = void 0;
const lodash_1 = __importDefault(require("lodash"));
const url_1 = __importDefault(require("url"));
const nms_core_1 = require("../../core");
const nms_server_1 = require("../../server");
const nms_plugin_av_1 = require("./");
class NodeAvServer extends nms_server_1.NodeConfigurableServer {
    constructor() {
        super();
        this.handleWsRequest = this.handleWsRequest.bind(this);
    }
    attachHttpServer(httpServer) {
        httpServer.app.all('/{*splat}.flv', (req, res) => {
            this.handleHttpRequest(req, res);
        });
        nms_core_1.context.nodeEvent.on('wsConnection', this.handleWsRequest);
    }
    handleHttpRequest(req, res) {
        if (!this.isRunning()) {
            res.sendStatus(404);
            return;
        }
        const [streamApp, streamName] = req.params.splat;
        const streamPath = '/' + streamApp + '/' + streamName;
        const streamQuery = req.query;
        const streamHost = req.hostname;
        const isPublisher = req.method === 'POST';
        this.createSession(req, res, nms_server_1.Protocol.HTTP_FLV, {
            streamPath,
            streamQuery,
            streamApp,
            streamName,
            streamHost,
            isPublisher,
        });
    }
    handleWsRequest(ws, req) {
        if (!this.isRunning()) {
            ws.close();
            return;
        }
        const urlInfo = url_1.default.parse(req.url, true);
        const streamHost = req.headers.host?.split(':')[0];
        const pathname = urlInfo.pathname || '';
        const streamPath = pathname.split('.')[0];
        const streamApp = streamPath.split('/')[1];
        const streamName = streamPath.split('/')[2];
        const streamQuery = urlInfo.query;
        let isPublisher = false;
        if (ws.protocol && (ws.protocol.toLowerCase() === 'post' || ws.protocol.toLowerCase() === 'publisher')) {
            isPublisher = true;
        }
        this.createSession(req, ws, nms_server_1.Protocol.WS_FLV, {
            streamPath,
            streamQuery,
            streamApp,
            streamName,
            streamHost,
            isPublisher,
        });
    }
    createSession(req, res, protocol, info) {
        const sessionConf = {
            auth: lodash_1.default.cloneDeep(this.config.auth),
        };
        const remoteIp = (req.ip || req.socket.remoteAddress) + ':' + req.socket.remotePort;
        let session = new nms_plugin_av_1.NodeAvSession(sessionConf, remoteIp, protocol, info);
        session.setTransport(req, res);
        session.run();
    }
}
exports.NodeAvServer = NodeAvServer;
