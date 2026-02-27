"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeRtmpServer = void 0;
const fs_1 = __importDefault(require("fs"));
const lodash_1 = __importDefault(require("lodash"));
const net_1 = __importDefault(require("net"));
const tls_1 = __importDefault(require("tls"));
const nms_core_1 = require("../../core");
const nms_server_1 = require("..");
const NodeRtmpSession_js_1 = require("./NodeRtmpSession.js");
const RTMP_PORT = 1935;
const RTMPS_PORT = 443;
class NodeRtmpServer extends nms_server_1.NodeConfigurableServer {
    port;
    tcpServer;
    sslPort = null;
    tlsServer = null;
    logger = nms_core_1.LoggerFactory.getLogger('RTMP Server');
    constructor() {
        super();
    }
    initServer() {
        const sessionConfig = {
            rtmp: lodash_1.default.cloneDeep(this.config.rtmp),
            auth: lodash_1.default.cloneDeep(this.config.auth),
        };
        this.port = this.config.rtmp.port || RTMP_PORT;
        this.tcpServer = net_1.default.createServer((socket) => {
            let session = new NodeRtmpSession_js_1.NodeRtmpSession(sessionConfig, socket);
            session.run();
        });
        if (this.config.rtmp.ssl) {
            this.sslPort = this.config.rtmp.ssl.port || RTMPS_PORT;
            try {
                const options = {
                    key: fs_1.default.readFileSync(this.config.rtmp.ssl.key),
                    cert: fs_1.default.readFileSync(this.config.rtmp.ssl.cert),
                };
                this.tlsServer = tls_1.default.createServer(options, (socket) => {
                    let session = new NodeRtmpSession_js_1.NodeRtmpSession(sessionConfig, socket);
                    session.run();
                });
            }
            catch (e) {
                this.logger.error(`Node Media Rtmps Server error while reading ssl certs: <${e}>`);
            }
        }
    }
    async run() {
        await super.run();
        this.initServer();
        this.tcpServer.listen(this.port, () => {
            this.logger.log(`Node Media Rtmp Server started on port: ${this.port}`);
        });
        this.tcpServer.on('error', (e) => {
            this.logger.error(`Node Media Rtmp Server ${e}`);
        });
        this.tcpServer.on('close', () => {
            this.logger.log('Node Media Rtmp Server Close.');
        });
        if (this.tlsServer) {
            this.tlsServer.listen(this.sslPort, () => {
                this.logger.log(`Node Media Rtmps Server started on port: ${this.sslPort}`);
            });
            this.tlsServer.on('error', (e) => {
                this.logger.error(`Node Media Rtmps Server ${e}`);
            });
            this.tlsServer.on('close', () => {
                this.logger.log('Node Media Rtmps Server Close.');
            });
        }
    }
    stop() {
        super.stop();
        this.tcpServer.close();
        if (this.tlsServer) {
            this.tlsServer.close();
        }
        nms_core_1.context.sessions.forEach((session, id) => {
            if (session instanceof NodeRtmpSession_js_1.NodeRtmpSession) {
                session.stop();
            }
        });
        this.logger.log(`Node Media Rtmp Server stopped.`);
    }
}
exports.NodeRtmpServer = NodeRtmpServer;
