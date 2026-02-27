"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fission_js_1 = __importDefault(require("../controllers/fission.js"));
exports.default = (context) => {
    let router = express_1.default.Router();
    router.get('/', fission_js_1.default.getStreams.bind(context));
    router.delete('/:id', fission_js_1.default.delStream.bind(context));
    return router;
};
