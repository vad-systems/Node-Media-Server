"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const relay_js_1 = __importDefault(require("../controllers/relay.js"));
exports.default = (context) => {
    let router = express_1.default.Router();
    router.get('/', relay_js_1.default.getStreams.bind(context));
    router.get('/:id', relay_js_1.default.getStreamByID.bind(context));
    router.get('/:app/:name', relay_js_1.default.getStreamByName.bind(context));
    router.delete('/:id', relay_js_1.default.delStream.bind(context));
    return router;
};
