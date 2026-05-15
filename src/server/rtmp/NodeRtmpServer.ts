import Fs from 'fs';
import _ from 'lodash';
import Net from 'net';
import Tls from 'tls';
import { context, LoggerFactory } from '@vad-systems/nms-core';
import { NodeConfigurableServer } from '@vad-systems/nms-server';
import { NodeRtmpSession } from './NodeRtmpSession.js';

const RTMP_PORT = 1935;
const RTMPS_PORT = 443;

class NodeRtmpServer extends NodeConfigurableServer {
    private port: number;
    private tcpServer: Net.Server;
    private sslPort: number | null = null;
    private tlsServer: Tls.Server | null = null;
    private logger = LoggerFactory.getLogger('RTMP Server');

    constructor() {
        super();
    }

    initServer() {
        if (!this.config.rtmp) {
            this.logger.error(`Node Media Rtmp Server startup failed. Config rtmp is missing.`);
            return;
        }
        const sessionConfig = {
            rtmp: _.cloneDeep(this.config.rtmp),
            auth: _.cloneDeep(this.config.auth),
        };
        this.port = this.config.rtmp.port || RTMP_PORT;
        this.tcpServer = Net.createServer((socket) => {
            let session = new NodeRtmpSession(sessionConfig, socket);
            session.start();
        });

        if (this.config.rtmp.ssl) {
            this.sslPort = this.config.rtmp.ssl.port || RTMPS_PORT;
            try {
                const options = {
                    key: Fs.readFileSync(this.config.rtmp.ssl.key),
                    cert: Fs.readFileSync(this.config.rtmp.ssl.cert),
                };
                this.tlsServer = Tls.createServer(options, (socket) => {
                    let session = new NodeRtmpSession(sessionConfig, socket);
                    session.start();
                });
            } catch (e) {
                this.logger.error(`Node Media Rtmps Server error while reading ssl certs: <${e}>`);
            }
        }
    }

    async run() {
        if (!this.config.rtmp) {
            this.logger.error(`Node Media Rtmp Server startup failed. Config rtmp is missing.`);
            return;
        }

        // Cleanup any leftover RTMP sessions
        for (let session of context.sessions.values()) {
            if (session instanceof NodeRtmpSession) {
                session.stop();
                session.cleanup();
            }
        }

        await super.run();

        this.initServer();
        if (!this.tcpServer) return;

        this.tcpServer.listen(this.port, () => {
            this.logger.log(`[RTMP] Server started on port: ${this.port}`);
        });

        this.tcpServer.on('error', (e) => {
            this.logger.error(`[RTMP] Server error: ${e}`);
        });

        this.tcpServer.on('close', () => {
            this.logger.log('[RTMP] Server closed');
        });

        if (this.tlsServer) {
            this.tlsServer.listen(this.sslPort, () => {
                this.logger.log(`[RTMPS] Server started on port: ${this.sslPort}`);
            });

            this.tlsServer.on('error', (e: Error) => {
                this.logger.error(`[RTMPS] Server error: ${e}`);
            });

            this.tlsServer.on('close', () => {
                this.logger.log('[RTMPS] Server closed');
            });
        }
    }

    stop() {
        super.stop();

        this.tcpServer.close();

        if (this.tlsServer) {
            this.tlsServer.close();
        }

        context.sessions.forEach((session, id) => {
            if (session instanceof NodeRtmpSession) {
                session.stop();
                session.cleanup();
            }
        });

        this.logger.log(`[RTMP] Server stopped`);
    }
}

export { NodeRtmpServer };
