"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const trans_js_1 = __importDefault(require("../controllers/trans.js"));
exports.default = (context) => {
    let router = express_1.default.Router();
    router.get('/', trans_js_1.default.getStreams.bind(context));
    router.delete('/:id', trans_js_1.default.delStream.bind(context));
    return router;
};
