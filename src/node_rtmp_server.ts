import Fs from 'fs';
import _ from 'lodash';
import Net from 'net';
import Tls from 'tls';
import { Logger, context } from './core/index.js';
import { NodeRtmpSession } from './node_rtmp_session.js';
import { Config } from './types/index.js';

const RTMP_PORT = 1935;
const RTMPS_PORT = 443;

class NodeRtmpServer {
    port: number;
    tcpServer: Net.Server;
    sslPort: number | null = null;
    tlsServer: Tls.Server | null = null;

    constructor(config: Config) {
        const conf = _.cloneDeep(config);
        const sessionConfig = {
            rtmp: _.cloneDeep(config.rtmp),
            auth: _.cloneDeep(config.auth),
        };
        this.port = conf.rtmp.port || RTMP_PORT;
        this.tcpServer = Net.createServer((socket) => {
            let session = new NodeRtmpSession(sessionConfig, socket);
            session.run();
        });

        if (conf.rtmp.ssl) {
            this.sslPort = conf.rtmp.ssl.port || RTMPS_PORT;
            try {
                const options = {
                    key: Fs.readFileSync(conf.rtmp.ssl.key),
                    cert: Fs.readFileSync(conf.rtmp.ssl.cert),
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
        this.tcpServer.close();

        if (this.tlsServer) {
            this.tlsServer.close();
        }

        context.sessions.forEach((session, id) => {
            if (session instanceof NodeRtmpSession) {
                session.stop();
            }
        });
    }
}

export { NodeRtmpServer };
