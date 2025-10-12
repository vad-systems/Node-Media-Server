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
exports.NodeRtmpServer = void 0;
const fs_1 = __importDefault(require("fs"));
const lodash_1 = __importDefault(require("lodash"));
const net_1 = __importDefault(require("net"));
const tls_1 = __importDefault(require("tls"));
const index_js_1 = require("./core/index.js");
const node_rtmp_session_js_1 = require("./node_rtmp_session.js");
const RTMP_PORT = 1935;
const RTMPS_PORT = 443;
class NodeRtmpServer {
    constructor(config) {
        this.sslPort = null;
        this.tlsServer = null;
        const conf = lodash_1.default.cloneDeep(config);
        const sessionConfig = {
            rtmp: lodash_1.default.cloneDeep(config.rtmp),
            auth: lodash_1.default.cloneDeep(config.auth),
        };
        this.port = conf.rtmp.port || RTMP_PORT;
        this.tcpServer = net_1.default.createServer((socket) => {
            let session = new node_rtmp_session_js_1.NodeRtmpSession(sessionConfig, socket);
            session.run();
        });
        if (conf.rtmp.ssl) {
            this.sslPort = conf.rtmp.ssl.port || RTMPS_PORT;
            try {
                const options = {
                    key: fs_1.default.readFileSync(conf.rtmp.ssl.key),
                    cert: fs_1.default.readFileSync(conf.rtmp.ssl.cert),
                };
                this.tlsServer = tls_1.default.createServer(options, (socket) => {
                    let session = new node_rtmp_session_js_1.NodeRtmpSession(sessionConfig, socket);
                    session.run();
                });
            }
            catch (e) {
                index_js_1.Logger.error(`Node Media Rtmps Server error while reading ssl certs: <${e}>`);
            }
        }
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            this.tcpServer.listen(this.port, () => {
                index_js_1.Logger.log(`Node Media Rtmp Server started on port: ${this.port}`);
            });
            this.tcpServer.on('error', (e) => {
                index_js_1.Logger.error(`Node Media Rtmp Server ${e}`);
            });
            this.tcpServer.on('close', () => {
                index_js_1.Logger.log('Node Media Rtmp Server Close.');
            });
            if (this.tlsServer) {
                this.tlsServer.listen(this.sslPort, () => {
                    index_js_1.Logger.log(`Node Media Rtmps Server started on port: ${this.sslPort}`);
                });
                this.tlsServer.on('error', (e) => {
                    index_js_1.Logger.error(`Node Media Rtmps Server ${e}`);
                });
                this.tlsServer.on('close', () => {
                    index_js_1.Logger.log('Node Media Rtmps Server Close.');
                });
            }
        });
    }
    stop() {
        this.tcpServer.close();
        if (this.tlsServer) {
            this.tlsServer.close();
        }
        index_js_1.context.sessions.forEach((session, id) => {
            if (session instanceof node_rtmp_session_js_1.NodeRtmpSession) {
                session.stop();
            }
        });
    }
}
exports.NodeRtmpServer = NodeRtmpServer;
