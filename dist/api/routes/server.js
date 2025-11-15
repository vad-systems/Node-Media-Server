"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const server_js_1 = __importDefault(require("../controllers/server.js"));
exports.default = (context) => {
    let router = express_1.default.Router();
    router.get('/', server_js_1.default.getInfo.bind(context));
    router.get('/config', server_js_1.default.getConfig.bind(context));
    router.patch('/config', server_js_1.default.updateConfig.bind(context));
    return router;
};
