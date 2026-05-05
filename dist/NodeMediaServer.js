"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const nms_core_1 = require("./core");
const nms_plugin_fission_1 = require("./plugins/fission");
const nms_server_1 = require("./server");
const nms_plugin_av_1 = require("./plugins/av");
const nms_plugin_relay_1 = require("./plugins/relay");
const nms_plugin_trans_1 = require("./plugins/trans");
const nms_plugin_switch_1 = require("./plugins/switch");
const types = __importStar(require("./shared"));
const nms_shared_1 = require("./shared");
const Package = require('../package.json');
class NodeMediaServer {
    rtmpServer;
    httpServer;
    avServer;
    transServer;
    relayServer;
    fissionServer;
    switchServer;
    logger = nms_core_1.LoggerFactory.getLogger('Core');
    static types = types;
    constructor(config) {
        this.updateConfig(config);
        nms_core_1.context.server = this;
        nms_core_1.context.nodeEvent.on('postPlay', (session) => {
            nms_core_1.context.stat.accepted++;
        });
        nms_core_1.context.nodeEvent.on('postPublish', (session) => {
            nms_core_1.context.stat.accepted++;
        });
        nms_core_1.context.nodeEvent.on('doneConnect', (session) => {
            if (session instanceof nms_plugin_av_1.NodeAvSession) {
                let socket = session.req.socket;
                nms_core_1.context.stat.inbytes += socket.bytesRead;
                nms_core_1.context.stat.outbytes += socket.bytesWritten;
            }
            else if (session instanceof nms_server_1.NodeRtmpSession) {
                let socket = session.socket;
                nms_core_1.context.stat.inbytes += socket.bytesRead;
                nms_core_1.context.stat.outbytes += socket.bytesWritten;
            }
        });
    }
    updateConfig(config) {
        nms_core_1.context.configProvider.setConfig(new nms_shared_1.Config(lodash_1.default.cloneDeep(config)));
    }
    async run() {
        const config = nms_core_1.context.configProvider.getConfig();
        nms_core_1.Logger.setLogType(config.logType);
        this.logger.log(`Node Media Server v${Package.version}`);
        if (config.rtmp) {
            this.rtmpServer = new nms_server_1.NodeRtmpServer();
            await this.rtmpServer.run();
        }
        if (config.http) {
            this.httpServer = new nms_server_1.NodeHttpServer();
            await this.httpServer.run();
            if (config.av) {
                this.avServer = new nms_plugin_av_1.NodeAvServer();
                this.avServer.attachHttpServer(this.httpServer);
                await this.avServer.run();
            }
        }
        const processorsRunning = [];
        if (config.trans) {
            if (config.cluster) {
                this.logger.warn('NodeTransServer does not work in cluster mode');
            }
            else {
                this.transServer = new nms_plugin_trans_1.NodeTransServer();
                processorsRunning.push(this.transServer.run());
            }
        }
        if (config.relay) {
            if (config.cluster) {
                this.logger.warn('NodeRelayServer does not work in cluster mode');
            }
            else {
                this.relayServer = new nms_plugin_relay_1.NodeRelayServer();
                processorsRunning.push(this.relayServer.run());
            }
        }
        if (config.fission) {
            if (config.cluster) {
                this.logger.warn('NodeFissionServer does not work in cluster mode');
            }
            else {
                this.fissionServer = new nms_plugin_fission_1.NodeFissionServer();
                processorsRunning.push(this.fissionServer.run());
            }
        }
        if (config.switch) {
            if (config.cluster) {
                this.logger.warn('NodeSwitchServer does not work in cluster mode');
            }
            else {
                this.switchServer = new nms_plugin_switch_1.NodeSwitchServer();
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
    on(eventName, listener) {
        nms_core_1.context.nodeEvent.on(eventName, listener);
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
        if (this.switchServer) {
            this.switchServer.stop();
        }
        if (this.transServer) {
            this.transServer.stop();
        }
    }
}
exports.default = NodeMediaServer;
