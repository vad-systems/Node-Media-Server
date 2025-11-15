"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("./core/index.js");
class NodeConfigurableServer {
    constructor() {
        this.config = index_js_1.context.configProvider.getConfig();
        this.onConfigChanged = this.onConfigChanged.bind(this);
        index_js_1.context.nodeEvent.on('configChanged', this.onConfigChanged);
    }
    onConfigChanged() {
        return __awaiter(this, void 0, void 0, function* () {
            this.config = index_js_1.context.configProvider.getConfig();
            if (this.running) {
                this.stop();
                yield this.run();
            }
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            this.running = true;
        });
    }
    stop() {
        this.running = false;
    }
}
exports.default = NodeConfigurableServer;
