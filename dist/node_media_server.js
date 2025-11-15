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
const index_js_1 = require("./core/index.js");
const node_fission_server_js_1 = require("./node_fission_server.js");
const node_http_server_js_1 = require("./node_http_server.js");
const node_relay_server_js_1 = require("./node_relay_server.js");
const node_rtmp_server_js_1 = require("./node_rtmp_server.js");
const node_trans_server_js_1 = require("./node_trans_server.js");
const types = __importStar(require("./types/index.js"));
const index_js_2 = require("./types/index.js");
const Package = require('../package.json');
class NodeMediaServer {
    constructor(config) {
        this.updateConfig(config);
    }
    updateConfig(config) {
        index_js_1.context.configProvider.setConfig(new index_js_2.Config(lodash_1.default.cloneDeep(config)));
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const config = index_js_1.context.configProvider.getConfig();
            index_js_1.Logger.setLogType(config.logType);
            index_js_1.Logger.log(`Node Media Server v${Package.version}`);
            if (config.rtmp) {
                this.rtmpServer = new node_rtmp_server_js_1.NodeRtmpServer();
                yield this.rtmpServer.run();
            }
            if (config.http) {
                this.httpServer = new node_http_server_js_1.NodeHttpServer();
                yield this.httpServer.run();
            }
            const processorsRunning = [];
            if (config.trans) {
                if (config.cluster) {
                    index_js_1.Logger.log('NodeTransServer does not work in cluster mode');
                }
                else {
                    this.transServer = new node_trans_server_js_1.NodeTransServer();
                    processorsRunning.push(this.transServer.run());
                }
            }
            if (config.relay) {
                if (config.cluster) {
                    index_js_1.Logger.log('NodeRelayServer does not work in cluster mode');
                }
                else {
                    this.relayServer = new node_relay_server_js_1.NodeRelayServer();
                    processorsRunning.push(this.relayServer.run());
                }
            }
            if (config.fission) {
                if (config.cluster) {
                    index_js_1.Logger.log('NodeFissionServer does not work in cluster mode');
                }
                else {
                    this.fissionServer = new node_fission_server_js_1.NodeFissionServer();
                    processorsRunning.push(this.fissionServer.run());
                }
            }
            process.on('uncaughtException', function (err) {
                index_js_1.Logger.error('uncaughtException', err);
            });
            process.on('SIGINT', function () {
                process.exit();
            });
            yield Promise.allSettled(processorsRunning);
        });
    }
    on(eventName, listener) {
        index_js_1.context.nodeEvent.on(eventName, listener);
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
NodeMediaServer.types = types;
exports.default = NodeMediaServer;
