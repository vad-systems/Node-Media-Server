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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const index_js_1 = require("../core/index.js");
const BaseAvSession_js_1 = require("./BaseAvSession.js");
const NodeConfigurableServer_js_1 = __importDefault(require("./NodeConfigurableServer.js"));
class NodeTaskServer extends NodeConfigurableServer_js_1.default {
    constructor() {
        super();
        this.onPostPublish = this.onPostPublish.bind(this);
        this.onDonePublish = this.onDonePublish.bind(this);
    }
    run() {
        const _super = Object.create(null, {
            run: { get: () => super.run }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.run.call(this);
            index_js_1.context.nodeEvent.on('postPublish', this.onPostPublish);
            index_js_1.context.nodeEvent.on('donePublish', this.onDonePublish);
        });
    }
    stop() {
        super.stop();
        index_js_1.context.nodeEvent.off('postPublish', this.onPostPublish);
        index_js_1.context.nodeEvent.off('donePublish', this.onDonePublish);
    }
    onPostPublish(session) {
        if (session instanceof BaseAvSession_js_1.BaseAvSession) {
            const regRes = /\/(.*)\/(.*)/gi.exec(session.streamPath);
            if (regRes) {
                const [app, name] = lodash_1.default.slice(regRes, 1);
                this.handleTaskMatching(session, app, name);
            }
        }
    }
    onDonePublish(session) {
        // BroadcastServer handles automatic cleanup of task-subscribers in donePublish.
        // Subclasses can implement extra cleanup logic if necessary.
    }
}
exports.default = NodeTaskServer;
