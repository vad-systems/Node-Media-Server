"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const node_core_logger_1 = require("./node_core_logger");
const node_rtmp_server_1 = require("./node_rtmp_server");
const node_http_server_1 = require("./node_http_server");
const node_trans_server_1 = require("./node_trans_server");
const node_relay_server_1 = require("./node_relay_server");
const node_fission_server_1 = require("./node_fission_server");
const node_core_ctx_1 = __importDefault(require("./node_core_ctx"));
const Package = require('../package.json');
class NodeMediaServer {
    constructor(config) {
        this.config = lodash_1.default.cloneDeep(config);
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            node_core_logger_1.Logger.setLogType(this.config.logType);
            node_core_logger_1.Logger.log(`Node Media Server v${Package.version}`);
            if (this.config.rtmp) {
                this.rtmpServer = new node_rtmp_server_1.NodeRtmpServer(this.config);
                yield this.rtmpServer.run();
            }
            if (this.config.http) {
                this.httpServer = new node_http_server_1.NodeHttpServer(this.config);
                yield this.httpServer.run();
            }
            const processorsRunning = [];
            if (this.config.trans) {
                if (this.config.cluster) {
                    node_core_logger_1.Logger.log('NodeTransServer does not work in cluster mode');
                }
                else {
                    this.transServer = new node_trans_server_1.NodeTransServer(this.config);
                    processorsRunning.push(this.transServer.run());
                }
            }
            if (this.config.relay) {
                if (this.config.cluster) {
                    node_core_logger_1.Logger.log('NodeRelayServer does not work in cluster mode');
                }
                else {
                    this.relayServer = new node_relay_server_1.NodeRelayServer(this.config);
                    processorsRunning.push(this.relayServer.run());
                }
            }
            if (this.config.fission) {
                if (this.config.cluster) {
                    node_core_logger_1.Logger.log('NodeFissionServer does not work in cluster mode');
                }
                else {
                    this.fissionServer = new node_fission_server_1.NodeFissionServer(this.config);
                    processorsRunning.push(this.fissionServer.run());
                }
            }
            process.on('uncaughtException', function (err) {
                node_core_logger_1.Logger.error('uncaughtException', err);
            });
            process.on('SIGINT', function () {
                process.exit();
            });
            yield Promise.allSettled(processorsRunning);
        });
    }
    on(eventName, listener) {
        node_core_ctx_1.default.nodeEvent.on(eventName, listener);
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
