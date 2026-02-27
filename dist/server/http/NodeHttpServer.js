"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeHttpServer = void 0;
const basic_auth_connect_1 = __importDefault(require("basic-auth-connect"));
const body_parser_1 = __importDefault(require("body-parser"));
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
const http2_express_1 = __importDefault(require("http2-express"));
const https_1 = __importDefault(require("https"));
const path_1 = __importDefault(require("path"));
const ws_1 = __importDefault(require("ws"));
const nms_api_1 = require("../../api");
const nms_core_1 = require("../../core");
const Protocol_js_1 = require("../base/Protocol.js");
const BaseAvSession_js_1 = require("../base/BaseAvSession.js");
const DEFAULTHTTP_PORT = 80;
const DEFAULT_HTTPS_PORT = 443;
const HTTP_MEDIAROOT = './media';
class NodeHttpServer {
    mediaroot;
    port;
    httpServer;
    wsServer;
    sport;
    httpsServer;
    wssServer;
    logger = nms_core_1.LoggerFactory.getLogger('HTTP Server');
    config;
    app;
    constructor() {
        this.config = nms_core_1.context.configProvider.getConfig();
        nms_core_1.context.nodeEvent.on('configChanged', () => {
            this.config = nms_core_1.context.configProvider.getConfig();
        });
    }
    isRunning() {
        return !!this.httpServer;
    }
    initServer() {
        this.port = this.config.http.port || DEFAULTHTTP_PORT;
        this.mediaroot = this.config.http.mediaroot || HTTP_MEDIAROOT;
        this.app = (0, http2_express_1.default)(express_1.default);
        this.app.use(body_parser_1.default.json());
        this.app.use(body_parser_1.default.urlencoded({ extended: true }));
        this.app.all('/{*splat}', (req, res, next) => {
            res.header('Access-Control-Allow-Origin', this.config.http.allow_origin);
            res.header('Access-Control-Allow-Headers', 'Content-Type,Content-Length, Authorization, Accept,X-Requested-With');
            res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS');
            res.header('Access-Control-Allow-Credentials', 'true');
            req.method === 'OPTIONS' ? res.sendStatus(200) : next();
        });
        const adminEntry = path_1.default.join(__dirname + '/../../../public/admin/index.html');
        if (fs_1.default.existsSync(adminEntry)) {
            this.app.get('/admin/*splat', (req, res) => {
                res.sendFile(adminEntry);
            });
        }
        if (this.config.http.api !== false) {
            if (this.config.auth && this.config.auth.api) {
                this.app.use(['/api/*splat', '/static/*splat', '/admin/*splat'], (0, basic_auth_connect_1.default)(this.config.auth.api_user, this.config.auth.api_pass));
            }
            (0, nms_api_1.setupRoutes)(this.app, nms_core_1.context);
        }
        this.app.use(express_1.default.static(path_1.default.join(__dirname + '/../../../public')));
        this.app.use(express_1.default.static(this.mediaroot.toString()));
        if (this.config.http.webroot) {
            this.app.use(express_1.default.static(this.config.http.webroot));
        }
        this.httpServer = http_1.default.createServer(this.app);
        if (this.config.https) {
            let options = {
                key: fs_1.default.readFileSync(this.config.https.key),
                cert: fs_1.default.readFileSync(this.config.https.cert),
            };
            if (this.config.https.passphrase) {
                Object.assign(options, { passphrase: this.config.https.passphrase });
            }
            this.sport = this.config.https.port || DEFAULT_HTTPS_PORT;
            this.httpsServer = https_1.default.createServer(options, this.app);
        }
    }
    async run() {
        this.initServer();
        this.httpServer.listen(this.port, () => {
            this.logger.log(`Node Media Http Server started on port: ${this.port}`);
        });
        this.httpServer.on('error', (e) => {
            this.logger.error(`Node Media Http Server ${e}`);
        });
        this.httpServer.on('close', () => {
            this.logger.log('Node Media Http Server closed');
        });
        this.wsServer = new ws_1.default.Server({ server: this.httpServer });
        this.wsServer.on('connection', (ws, req) => {
            nms_core_1.context.nodeEvent.emit('wsConnection', ws, req);
        });
        this.wsServer.on('listening', () => {
            this.logger.log(`Node Media WebSocket Server started on port: ${this.port}`);
        });
        this.wsServer.on('error', (e) => {
            this.logger.error(`Node Media WebSocket Server ${e}`);
        });
        this.wsServer.on('close', () => {
            this.logger.log(`Node Media WebSocket Server closed`);
        });
        if (this.httpsServer) {
            this.httpsServer.listen(this.sport, () => {
                this.logger.log(`Node Media Https Server started on port: ${this.sport}`);
            });
            this.httpsServer.on('error', (e) => {
                this.logger.error(`Node Media Https Server ${e}`);
            });
            this.httpsServer.on('close', () => {
                this.logger.log('Node Media Https Server Close.');
            });
            this.wssServer = new ws_1.default.Server({ server: this.httpsServer });
            this.wssServer.on('connection', (ws, req) => {
                nms_core_1.context.nodeEvent.emit('wsConnection', ws, req);
            });
            this.wssServer.on('listening', () => {
                this.logger.log(`Node Media WebSocketSecure Server started on port: ${this.sport}`);
            });
            this.wssServer.on('error', (e) => {
                this.logger.error(`Node Media WebSocketSecure Server ${e}`);
            });
            this.wssServer.on('close', () => {
                this.logger.log(`Node Media WebSocketSecure Server closed`);
            });
        }
    }
    stop() {
        this.httpServer.close();
        if (this.httpsServer) {
            this.httpsServer.close();
        }
        this.wsServer.close();
        if (this.wssServer) {
            this.wssServer.close();
        }
        nms_core_1.context.sessions.forEach((session, id) => {
            if (session instanceof BaseAvSession_js_1.BaseAvSession) {
                if (session.protocol === Protocol_js_1.Protocol.HTTP_FLV || session.protocol === Protocol_js_1.Protocol.WS_FLV) {
                    session.stop();
                }
            }
        });
        this.logger.log(`Node Media Http Server stopped.`);
    }
}
exports.NodeHttpServer = NodeHttpServer;
