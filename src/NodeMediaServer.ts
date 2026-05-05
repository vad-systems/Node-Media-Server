import _ from 'lodash';
import { context, Logger, LoggerFactory } from '@vad-systems/nms-core';
import { NodeFissionServer } from '@vad-systems/nms-plugin-fission';
import { NodeHttpServer, NodeRtmpServer, NodeRtmpSession } from '@vad-systems/nms-server';
import { NodeAvServer, NodeAvSession } from '@vad-systems/nms-plugin-av';
import { NodeRelayServer } from '@vad-systems/nms-plugin-relay';
import { NodeTransServer } from '@vad-systems/nms-plugin-trans';
import { NodeSwitchServer } from '@vad-systems/nms-plugin-switch';
import * as types from '@vad-systems/nms-shared';
import { Config, ConfigType, NodeEventMap } from '@vad-systems/nms-shared';

const Package = require('../package.json');

class NodeMediaServer {
    public rtmpServer?: NodeRtmpServer;
    public httpServer?: NodeHttpServer;
    public avServer?: NodeAvServer;
    public transServer?: NodeTransServer;
    public relayServer?: NodeRelayServer;
    public fissionServer?: NodeFissionServer;
    public switchServer?: NodeSwitchServer;
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

            if (config.av) {
                this.avServer = new NodeAvServer();
                this.avServer.attachHttpServer(this.httpServer);
                await this.avServer.run();
            }
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

        if (config.switch) {
            if (config.cluster) {
                this.logger.warn('NodeSwitchServer does not work in cluster mode');
            } else {
                this.switchServer = new NodeSwitchServer();
                processorsRunning.push(this.switchServer.run());
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

    public on<K extends keyof NodeEventMap>(eventName: K, listener: (...args: NodeEventMap[K]) => void) {
        context.nodeEvent.on(eventName, listener as any);
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

        if (this.switchServer) {
            this.switchServer.stop();
        }

        if (this.transServer) {
            this.transServer.stop();
        }
    }
}

export default NodeMediaServer;
