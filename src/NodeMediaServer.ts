import _ from 'lodash';
import { context, Logger } from './core/index.js';
import { NodeFissionServer } from './server/fission/NodeFissionServer.js';
import { NodeHttpServer } from './server/http/NodeHttpServer.js';
import { NodeRelayServer } from './server/relay/NodeRelayServer.js';
import { NodeRtmpServer } from './server/rtmp/NodeRtmpServer.js';
import { NodeTransServer } from './server/trans/NodeTransServer.js';
import * as types from './types/index.js';
import { Config, ConfigType, NodeEventMap } from './types/index.js';

const Package = require('../package.json');

class NodeMediaServer {
    public rtmpServer?: NodeRtmpServer;
    public httpServer?: NodeHttpServer;
    public transServer?: NodeTransServer;
    public relayServer?: NodeRelayServer;
    public fissionServer?: NodeFissionServer;

    static types = types;

    constructor(config: ConfigType) {
        this.updateConfig(config);
        context.server = this;
    }

    public updateConfig(config: ConfigType) {
        context.configProvider.setConfig(new Config(_.cloneDeep(config)));
    }

    public async run() {
        const config = context.configProvider.getConfig();
        Logger.setLogType(config.logType);
        Logger.log(`Node Media Server v${Package.version}`);

        if (config.rtmp) {
            this.rtmpServer = new NodeRtmpServer();
            await this.rtmpServer.run();
        }

        if (config.http) {
            this.httpServer = new NodeHttpServer();
            await this.httpServer.run();
        }

        const processorsRunning: Promise<void>[] = [];

        if (config.trans) {
            if (config.cluster) {
                Logger.log('NodeTransServer does not work in cluster mode');
            } else {
                this.transServer = new NodeTransServer();
                processorsRunning.push(this.transServer.run());
            }
        }

        if (config.relay) {
            if (config.cluster) {
                Logger.log('NodeRelayServer does not work in cluster mode');
            } else {
                this.relayServer = new NodeRelayServer();
                processorsRunning.push(this.relayServer.run());
            }
        }

        if (config.fission) {
            if (config.cluster) {
                Logger.log('NodeFissionServer does not work in cluster mode');
            } else {
                this.fissionServer = new NodeFissionServer();
                processorsRunning.push(this.fissionServer.run());
            }
        }

        process.on('uncaughtException', function (err) {
            Logger.error('uncaughtException', err);
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
    }
}

export default NodeMediaServer;
