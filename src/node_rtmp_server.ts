import Fs from 'fs';
import _ from 'lodash';
import Net from 'net';
import Tls from 'tls';
import { context, Logger } from './core/index.js';
import NodeConfigurableServer from './node_configurable_server.js';
import { NodeRtmpSession } from './node_rtmp_session.js';

const RTMP_PORT = 1935;
const RTMPS_PORT = 443;

class NodeRtmpServer extends NodeConfigurableServer {
    private port: number;
    private tcpServer: Net.Server;
    private sslPort: number | null = null;
    private tlsServer: Tls.Server | null = null;

    constructor() {
        super();
    }

    initServer() {
        const sessionConfig = {
            rtmp: _.cloneDeep(this.config.rtmp),
            auth: _.cloneDeep(this.config.auth),
        };
        this.port = this.config.rtmp.port || RTMP_PORT;
        this.tcpServer = Net.createServer((socket) => {
            let session = new NodeRtmpSession(sessionConfig, socket);
            session.run();
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
                    session.run();
                });
            } catch (e) {
                Logger.error(`Node Media Rtmps Server error while reading ssl certs: <${e}>`);
            }
        }
    }

    async run() {
        await super.run();

        this.initServer();

        this.tcpServer.listen(this.port, () => {
            Logger.log(`Node Media Rtmp Server started on port: ${this.port}`);
        });

        this.tcpServer.on('error', (e) => {
            Logger.error(`Node Media Rtmp Server ${e}`);
        });

        this.tcpServer.on('close', () => {
            Logger.log('Node Media Rtmp Server Close.');
        });

        if (this.tlsServer) {
            this.tlsServer.listen(this.sslPort, () => {
                Logger.log(`Node Media Rtmps Server started on port: ${this.sslPort}`);
            });

            this.tlsServer.on('error', (e: Error) => {
                Logger.error(`Node Media Rtmps Server ${e}`);
            });

            this.tlsServer.on('close', () => {
                Logger.log('Node Media Rtmps Server Close.');
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
            }
        });

        Logger.log(`Node Media Rtmp Server stopped.`);
    }
}

export { NodeRtmpServer };
