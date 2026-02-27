"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlvVideoCodec = exports.FlvAudioCodec = exports.Rtmp = exports.Flv = exports.AVPacket = exports.av = exports.amf = exports.Bitop = void 0;
const bitop_js_1 = __importDefault(require("./bitop.js"));
exports.Bitop = bitop_js_1.default;
const amf = __importStar(require("./amf.js"));
exports.amf = amf;
const av = __importStar(require("./av.js"));
exports.av = av;
const AVPacket_js_1 = __importDefault(require("./AVPacket.js"));
exports.AVPacket = AVPacket_js_1.default;
const flv_js_1 = __importStar(require("./flv.js"));
exports.Flv = flv_js_1.default;
Object.defineProperty(exports, "FlvAudioCodec", { enumerable: true, get: function () { return flv_js_1.FlvAudioCodec; } });
Object.defineProperty(exports, "FlvVideoCodec", { enumerable: true, get: function () { return flv_js_1.FlvVideoCodec; } });
const rtmp_js_1 = __importDefault(require("./rtmp.js"));
exports.Rtmp = rtmp_js_1.default;
