import Fs from 'fs';
import _ from 'lodash';
import Net from 'net';
import Tls from 'tls';
import { context, LoggerFactory } from '../../core/index.js';
import NodeConfigurableServer from '../NodeConfigurableServer.js';
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

            this.tlsServer.on('error', (e: Error) => {
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

        context.sessions.forEach((session, id) => {
            if (session instanceof NodeRtmpSession) {
                session.stop();
            }
        });

        this.logger.log(`Node Media Rtmp Server stopped.`);
    }
}

export { NodeRtmpServer };
