"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const streams_controller_js_1 = __importDefault(require("./streams.controller.js"));
exports.default = (context) => {
    let router = express_1.default.Router();
    router.get('/', streams_controller_js_1.default.getStreams.bind(context));
    router.get('/tree', streams_controller_js_1.default.getStreamsTree.bind(context));
    router.get('/:app/:stream', streams_controller_js_1.default.getStream.bind(context));
    router.delete('/:app/:stream', streams_controller_js_1.default.delStream.bind(context));
    router.post('/:app/:stream/stop', streams_controller_js_1.default.stopBroadcast.bind(context));
    router.post('/session/:id/start', streams_controller_js_1.default.startSession.bind(context));
    router.post('/session/:id/stop', streams_controller_js_1.default.stopSession.bind(context));
    router.post('/session/:id/restart', streams_controller_js_1.default.restartSession.bind(context));
    return router;
};
