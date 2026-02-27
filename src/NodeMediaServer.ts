import _ from 'lodash';
import { context, Logger, LoggerFactory } from './core/index.js';
import { NodeFissionServer } from './server/fission/NodeFissionServer.js';
import { NodeAvServer } from './server/http/NodeAvServer.js';
import { NodeAvSession } from './server/http/NodeAvSession.js';
import { NodeHttpServer } from './server/http/NodeHttpServer.js';
import { NodeRelayServer } from './server/relay/NodeRelayServer.js';
import { NodeRtmpServer } from './server/rtmp/NodeRtmpServer.js';
import { NodeRtmpSession } from './server/rtmp/NodeRtmpSession.js';
import { NodeTransServer } from './server/trans/NodeTransServer.js';
import * as types from './types/index.js';
import { Config, ConfigType, NodeEventMap } from './types/index.js';

const Package = require('../package.json');

class NodeMediaServer {
    public rtmpServer?: NodeRtmpServer;
    public httpServer?: NodeHttpServer;
    public avServer?: NodeAvServer;
    public transServer?: NodeTransServer;
    public relayServer?: NodeRelayServer;
    public fissionServer?: NodeFissionServer;
    private logger = LoggerFactory.getLogger('Core');

    static types = types;

    constructor(config: ConfigType) {
        this.updateConfig(config);
        context.server = this;

        context.nodeEvent.on('postPlay', (session) => {
            context.stat.accepted++;
        });

        context.nodeEvent.on('postPublish', (session) => {
            context.stat.accepted++;
        });

        context.nodeEvent.on('doneConnect', (session) => {
            if (session instanceof NodeAvSession) {
                let socket = session.req.socket;
                context.stat.inbytes += socket.bytesRead;
                context.stat.outbytes += socket.bytesWritten;
            } else if (session instanceof NodeRtmpSession) {
                let socket = session.socket;
                context.stat.inbytes += socket.bytesRead;
                context.stat.outbytes += socket.bytesWritten;
            }
        });
    }

    public updateConfig(config: ConfigType) {
        context.configProvider.setConfig(new Config(_.cloneDeep(config)));
    }

    public async run() {
        const config = context.configProvider.getConfig();
        Logger.setLogType(config.logType);
        this.logger.log(`Node Media Server v${Package.version}`);

        if (config.rtmp) {
            this.rtmpServer = new NodeRtmpServer();
            await this.rtmpServer.run();
        }

        if (config.http) {
            this.httpServer = new NodeHttpServer();
            await this.httpServer.run();
            this.avServer = this.httpServer.avServer;
        }

        const processorsRunning: Promise<void>[] = [];

        if (config.trans) {
            if (config.cluster) {
                this.logger.warn('NodeTransServer does not work in cluster mode');
            } else {
                this.transServer = new NodeTransServer();
                processorsRunning.push(this.transServer.run());
            }
        }

        if (config.relay) {
            if (config.cluster) {
                this.logger.warn('NodeRelayServer does not work in cluster mode');
            } else {
                this.relayServer = new NodeRelayServer();
                processorsRunning.push(this.relayServer.run());
            }
        }

        if (config.fission) {
            if (config.cluster) {
                this.logger.warn('NodeFissionServer does not work in cluster mode');
            } else {
                this.fissionServer = new NodeFissionServer();
                processorsRunning.push(this.fissionServer.run());
            }
        }

        process.on('uncaughtException', (err) => {
            this.logger.error('uncaughtException', err);
        });

        process.on('SIGINT', function () {
            process.exit();
        });

        await Promise.allSettled(processorsRunning);
    }

    public on(eventName: keyof NodeEventMap, listener: (...args: any[]) => void) {
        context.nodeEvent.on(eventName, listener);
    }

    public stop() {
        if (this.rtmpServer) {
            this.rtmpServer.stop();
        }

        if (this.httpServer) {
            this.httpServer.stop();
        }

        if (this.relayServer) {
            this.relayServer.stop();
        }

        if (this.fissionServer) {
            this.fissionServer.stop();
        }

        if (this.transServer) {
            this.transServer.stop();
        }
    }
}

export default NodeMediaServer;
