"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const controller_js_1 = __importDefault(require("./controller.js"));
exports.default = (context) => {
    let router = express_1.default.Router();
    router.post('/', controller_js_1.default.switchSource.bind(context));
    router.get('/', controller_js_1.default.getStatus.bind(context));
    return router;
};
