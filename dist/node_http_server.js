"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
const lodash_1 = __importDefault(require("lodash"));
const path_1 = __importDefault(require("path"));
const ws_1 = __importDefault(require("ws"));
const relay_js_1 = __importDefault(require("./api/routes/relay.js"));
const server_js_1 = __importDefault(require("./api/routes/server.js"));
const streams_js_1 = __importDefault(require("./api/routes/streams.js"));
const index_js_1 = require("./core/index.js");
const node_configurable_server_js_1 = __importDefault(require("./node_configurable_server.js"));
const node_http_session_js_1 = require("./node_http_session.js");
const node_rtmp_session_js_1 = require("./node_rtmp_session.js");
const index_js_2 = require("./types/index.js");
const HTTP_PORT = 80;
const HTTPS_PORT = 443;
const HTTP_MEDIAROOT = './media';
class NodeHttpServer extends node_configurable_server_js_1.default {
    constructor() {
        super();
        this.onPostPlay = this.onPostPlay.bind(this);
        this.onPostPublish = this.onPostPublish.bind(this);
        this.onDoneConnect = this.onDoneConnect.bind(this);
    }
    initServer() {
        this.port = this.config.http.port || HTTP_PORT;
        this.mediaroot = this.config.http.mediaroot || HTTP_MEDIAROOT;
        const app = (0, http2_express_1.default)(express_1.default);
        app.use(body_parser_1.default.json());
        app.use(body_parser_1.default.urlencoded({ extended: true }));
        app.all('/{*splat}', (req, res, next) => {
            res.header('Access-Control-Allow-Origin', this.config.http.allow_origin);
            res.header('Access-Control-Allow-Headers', 'Content-Type,Content-Length, Authorization, Accept,X-Requested-With');
            res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS');
            res.header('Access-Control-Allow-Credentials', 'true');
            req.method === 'OPTIONS' ? res.sendStatus(200) : next();
        });
        app.get('/{*splat}.flv', (req, res, next) => {
            const nmsReq = {
                req,
                nmsConnectionType: index_js_2.NodeConnectionType.HTTP,
                remoteAddress: req.ip,
            };
            const nmsRes = {
                res,
            };
            this.handleConnect(nmsReq, nmsRes);
        });
        const adminEntry = path_1.default.join(__dirname + '/../public/admin/index.html');
        if (fs_1.default.existsSync(adminEntry)) {
            app.get('/admin/*splat', (req, res) => {
                res.sendFile(adminEntry);
            });
        }
        if (this.config.http.api !== false) {
            if (this.config.auth && this.config.auth.api) {
                app.use(['/api/*splat', '/static/*splat', '/admin/*splat'], (0, basic_auth_connect_1.default)(this.config.auth.api_user, this.config.auth.api_pass));
            }
            app.use('/api/streams', (0, streams_js_1.default)(index_js_1.context));
            app.use('/api/server', (0, server_js_1.default)(index_js_1.context));
            app.use('/api/relay', (0, relay_js_1.default)(index_js_1.context));
        }
        app.use(express_1.default.static(path_1.default.join(__dirname + '/../public')));
        app.use(express_1.default.static(this.mediaroot.toString()));
        if (this.config.http.webroot) {
            app.use(express_1.default.static(this.config.http.webroot));
        }
        this.httpServer = http_1.default.createServer(app);
        if (this.config.https) {
            let options = {
                key: fs_1.default.readFileSync(this.config.https.key),
                cert: fs_1.default.readFileSync(this.config.https.cert),
            };
            if (this.config.https.passphrase) {
                Object.assign(options, { passphrase: this.config.https.passphrase });
            }
            this.sport = this.config.https.port || HTTPS_PORT;
            this.httpsServer = https_1.default.createServer(options, app);
        }
    }
    run() {
        const _super = Object.create(null, {
            run: { get: () => super.run }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.run.call(this);
            this.initServer();
            this.httpServer.listen(this.port, () => {
                index_js_1.Logger.log(`Node Media Http Server started on port: ${this.port}`);
            });
            this.httpServer.on('error', (e) => {
                index_js_1.Logger.error(`Node Media Http Server ${e}`);
            });
            this.httpServer.on('close', () => {
                index_js_1.Logger.log('Node Media Http Server closed');
            });
            this.wsServer = new ws_1.default.Server({ server: this.httpServer });
            this.wsServer.on('connection', (ws, req) => {
                const nmsReq = {
                    req,
                    nmsConnectionType: index_js_2.NodeConnectionType.WS,
                    remoteAddress: req.socket.remoteAddress,
                };
                const nmsRes = {
                    res: ws,
                };
                this.handleConnect(nmsReq, nmsRes);
            });
            this.wsServer.on('listening', () => {
                index_js_1.Logger.log(`Node Media WebSocket Server started on port: ${this.port}`);
            });
            this.wsServer.on('error', (e) => {
                index_js_1.Logger.error(`Node Media WebSocket Server ${e}`);
            });
            this.wsServer.on('close', () => {
                index_js_1.Logger.log(`Node Media WebSocket Server closed`);
            });
            if (this.httpsServer) {
                this.httpsServer.listen(this.sport, () => {
                    index_js_1.Logger.log(`Node Media Https Server started on port: ${this.sport}`);
                });
                this.httpsServer.on('error', (e) => {
                    index_js_1.Logger.error(`Node Media Https Server ${e}`);
                });
                this.httpsServer.on('close', () => {
                    index_js_1.Logger.log('Node Media Https Server Close.');
                });
                this.wssServer = new ws_1.default.Server({ server: this.httpsServer });
                this.wssServer.on('connection', (ws, req) => {
                    const nmsReq = {
                        req,
                        nmsConnectionType: index_js_2.NodeConnectionType.WS,
                        remoteAddress: req.socket.remoteAddress,
                    };
                    const nmsRes = {
                        res: ws,
                    };
                    this.handleConnect(nmsReq, nmsRes);
                });
                this.wssServer.on('listening', () => {
                    index_js_1.Logger.log(`Node Media WebSocketSecure Server started on port: ${this.sport}`);
                });
                this.wssServer.on('error', (e) => {
                    index_js_1.Logger.error(`Node Media WebSocketSecure Server ${e}`);
                });
                this.wssServer.on('close', () => {
                    index_js_1.Logger.log(`Node Media WebSocketSecure Server closed`);
                });
            }
            index_js_1.context.nodeEvent.on('postPlay', this.onPostPlay);
            index_js_1.context.nodeEvent.on('postPublish', this.onPostPublish);
            index_js_1.context.nodeEvent.on('doneConnect', this.onDoneConnect);
        });
    }
    onPostPlay(id, streamPath, args) {
        index_js_1.context.stat.accepted++;
    }
    onPostPublish(id, streamPath, args) {
        index_js_1.context.stat.accepted++;
    }
    onDoneConnect(id, connectCmdObj) {
        let session = index_js_1.context.sessions.get(id);
        if (session instanceof node_http_session_js_1.NodeHttpSession) {
            let socket = session.req.socket;
            index_js_1.context.stat.inbytes += socket.bytesRead;
            index_js_1.context.stat.outbytes += socket.bytesWritten;
        }
        else if (session instanceof node_rtmp_session_js_1.NodeRtmpSession) {
            let socket = session.socket;
            index_js_1.context.stat.inbytes += socket.bytesRead;
            index_js_1.context.stat.outbytes += socket.bytesWritten;
        }
    }
    stop() {
        super.stop();
        index_js_1.context.nodeEvent.off('postPlay', this.onPostPlay);
        index_js_1.context.nodeEvent.off('postPublish', this.onPostPublish);
        index_js_1.context.nodeEvent.off('doneConnect', this.onDoneConnect);
        this.httpServer.close();
        if (this.httpsServer) {
            this.httpsServer.close();
        }
        this.wsServer.close();
        if (this.wssServer) {
            this.wssServer.close();
        }
        index_js_1.context.sessions.forEach((session, id) => {
            if (session instanceof node_http_session_js_1.NodeHttpSession) {
                session.req.destroy();
                index_js_1.context.sessions.delete(id);
            }
        });
        index_js_1.Logger.log(`Node Media Http Server stopped.`);
    }
    handleConnect(req, res) {
        const sessionConf = {
            auth: lodash_1.default.cloneDeep(this.config.auth),
        };
        let session = new node_http_session_js_1.NodeHttpSession(sessionConf, req, res);
        session.run();
    }
}
exports.NodeHttpServer = NodeHttpServer;
