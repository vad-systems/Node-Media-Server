import * as types from "./types";
import {Config, NodeEventMap} from "./types";
import _ from 'lodash';
import {Logger} from './node_core_logger';
import {NodeRtmpServer} from './node_rtmp_server';
import {NodeHttpServer} from './node_http_server';
import {NodeTransServer} from './node_trans_server';
import {NodeRelayServer} from './node_relay_server';
import {NodeFissionServer} from './node_fission_server';
import context from './node_core_ctx';

const Package = require('../package.json');

class NodeMediaServer {
    config: Config;
    rtmpServer?: NodeRtmpServer;
    httpServer?: NodeHttpServer;
    transServer?: NodeTransServer;
    relayServer?: NodeRelayServer;
    fissionServer?: NodeFissionServer;

    static types = types;

    constructor(config: Config) {
        this.config = _.cloneDeep(config);
    }

    async run() {
        Logger.setLogType(this.config.logType);
        Logger.log(`Node Media Server v${Package.version}`);

        if (this.config.rtmp) {
            this.rtmpServer = new NodeRtmpServer(this.config);
            await this.rtmpServer.run();
        }

        if (this.config.http) {
            this.httpServer = new NodeHttpServer(this.config);
            await this.httpServer.run();
        }

        const processorsRunning: Promise<void>[] = [];

        if (this.config.trans) {
            if (this.config.cluster) {
                Logger.log('NodeTransServer does not work in cluster mode');
            } else {
                this.transServer = new NodeTransServer(this.config);
                processorsRunning.push(this.transServer.run());
            }
        }

        if (this.config.relay) {
            if (this.config.cluster) {
                Logger.log('NodeRelayServer does not work in cluster mode');
            } else {
                this.relayServer = new NodeRelayServer(this.config);
                processorsRunning.push(this.relayServer.run());
            }
        }

        if (this.config.fission) {
            if (this.config.cluster) {
                Logger.log('NodeFissionServer does not work in cluster mode');
            } else {
                this.fissionServer = new NodeFissionServer(this.config);
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

    on(eventName: keyof NodeEventMap, listener: (...args: any[]) => void) {
        context.nodeEvent.on(eventName, listener);
    }

    stop() {
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

module.exports = NodeMediaServer;
