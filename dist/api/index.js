"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRoutes = setupRoutes;
const server_router_js_1 = __importDefault(require("./server.router.js"));
const streams_router_js_1 = __importDefault(require("./streams.router.js"));
const nms_plugin_fission_1 = require("../plugins/fission");
const nms_plugin_relay_1 = require("../plugins/relay");
const nms_plugin_trans_1 = require("../plugins/trans");
const nms_plugin_switch_1 = require("../plugins/switch");
function setupRoutes(app, context) {
    const config = context.configProvider.getConfig();
    app.use('/api/streams', (0, streams_router_js_1.default)(context));
    app.use('/api/server', (0, server_router_js_1.default)(context));
    if (config.relay) {
        app.use('/api/relay', (0, nms_plugin_relay_1.relayApi)(context));
    }
    if (config.trans) {
        app.use('/api/trans', (0, nms_plugin_trans_1.transApi)(context));
    }
    if (config.fission) {
        app.use('/api/fission', (0, nms_plugin_fission_1.fissionApi)(context));
    }
    if (config.switch) {
        app.use('/api/switch', (0, nms_plugin_switch_1.switchApi)(context));
    }
}
