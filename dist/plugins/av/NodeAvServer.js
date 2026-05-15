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
const nms_core_2 = require("../../core");
class NodeAvServer extends nms_server_1.NodeConfigurableServer {
    logger = nms_core_2.LoggerFactory.getLogger('AV Server');
    constructor() {
        super();
        this.handleWsRequest = this.handleWsRequest.bind(this);
    }
    isAttached = false;
    attachHttpServer(httpServer) {
        if (this.isAttached) {
            return;
        }
        httpServer.app.all('/{*splat}.flv', (req, res) => {
            this.handleHttpRequest(req, res);
        });
        nms_core_1.context.nodeEvent.on('wsConnection', this.handleWsRequest);
        this.isAttached = true;
    }
    async run() {
        // Cleanup any leftover AV sessions
        for (let session of nms_core_1.context.sessions.values()) {
            if (session instanceof nms_plugin_av_1.NodeAvSession) {
                session.stop();
                session.cleanup();
            }
        }
        await super.run();
        this.logger.log('[AV] Server started');
        const server = nms_core_1.context.server;
        if (server?.httpServer?.isRunning()) {
            this.attachHttpServer(server.httpServer);
        }
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
        this.logger.log(`[AV] creating session: protocol=${protocol} streamPath=${info.streamPath} remoteIp=${remoteIp}`);
        session.setTransport(req, res);
        session.start();
    }
    stop() {
        super.stop();
        for (let session of nms_core_1.context.sessions.values()) {
            if (session instanceof nms_plugin_av_1.NodeAvSession) {
                session.stop();
                session.cleanup();
            }
        }
        this.logger.log('[AV] Server stopped');
    }
}
exports.NodeAvServer = NodeAvServer;
