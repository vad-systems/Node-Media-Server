"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const streams_js_1 = __importDefault(require("../controllers/streams.js"));
exports.default = (context) => {
    let router = express_1.default.Router();
    router.get('/', streams_js_1.default.getStreams.bind(context));
    router.get('/:app/:stream', streams_js_1.default.getStream.bind(context));
    router.delete('/:app/:stream', streams_js_1.default.delStream.bind(context));
    return router;
};
