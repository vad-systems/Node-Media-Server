"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRoutes = setupRoutes;
const fission_js_1 = __importDefault(require("./routes/fission.js"));
const relay_js_1 = __importDefault(require("./routes/relay.js"));
const server_js_1 = __importDefault(require("./routes/server.js"));
const streams_js_1 = __importDefault(require("./routes/streams.js"));
const trans_js_1 = __importDefault(require("./routes/trans.js"));
function setupRoutes(app, context) {
    app.use('/api/streams', (0, streams_js_1.default)(context));
    app.use('/api/server', (0, server_js_1.default)(context));
    app.use('/api/relay', (0, relay_js_1.default)(context));
    app.use('/api/trans', (0, trans_js_1.default)(context));
    app.use('/api/fission', (0, fission_js_1.default)(context));
}
