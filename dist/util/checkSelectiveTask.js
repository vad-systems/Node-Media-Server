"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const asRegExp_js_1 = __importDefault(require("./asRegExp.js"));
const checkSelectiveTask = (config, app, streamPath) => {
    const pattern = (0, asRegExp_js_1.default)(config.pattern);
    return (app === config.app
        && (!pattern || pattern.test(streamPath)));
};
exports.default = checkSelectiveTask;
