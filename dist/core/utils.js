"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNewSessionID = generateNewSessionID;
exports.verifyAuth = verifyAuth;
exports.getFFmpegVersion = getFFmpegVersion;
exports.getFFmpegUrl = getFFmpegUrl;
const child_process_1 = require("child_process");
const crypto_1 = __importDefault(require("crypto"));
const context_js_1 = __importDefault(require("./context.js"));
function generateNewSessionID() {
    let sessionID = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWKYZ0123456789';
    const numPossible = possible.length;
    do {
        for (let i = 0; i < 8; i++) {
            sessionID += possible.charAt((Math.random() * numPossible) | 0);
        }
    } while (context_js_1.default.sessions.has(sessionID));
    return sessionID;
}
function verifyAuth(signStr, streamId, secretKey) {
    if (signStr === undefined) {
        return false;
    }
    let now = Date.now() / 1000 | 0;
    let exp = parseInt(signStr.split('-')[0]);
    let shv = signStr.split('-')[1];
    let str = streamId + '-' + exp + '-' + secretKey;
    if (exp < now) {
        return false;
    }
    let md5 = crypto_1.default.createHash('md5');
    let ohv = md5.update(str).digest('hex');
    return shv === ohv;
}
function getFFmpegVersion(ffpath) {
    return new Promise((resolve, reject) => {
        let ffmpeg_exec = (0, child_process_1.spawn)(ffpath, ['-version']);
        let result = '';
        ffmpeg_exec.on('error', (e) => {
            reject(e);
        });
        ffmpeg_exec.stdout.on('data', (data) => {
            try {
                result += data;
            }
            catch (e) {
            }
        });
        ffmpeg_exec.on('close', (code) => {
            const version = result.toString().split(/(?:\r\n|\r|\n)/g)[0].split('\ ')[2];
            resolve(version);
        });
    });
}
function getFFmpegUrl() {
    switch (process.platform) {
        case 'darwin':
            return 'https://ffmpeg.zeranoe.com/builds/macos64/static/ffmpeg-latest-macos64-static.zip';
        case 'win32':
            return 'https://ffmpeg.zeranoe.com/builds/win64/static/ffmpeg-latest-win64-static.zip | https://ffmpeg.zeranoe.com/builds/win32/static/ffmpeg-latest-win32-static.zip';
        case 'linux':
            return 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz | https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-i686-static.tar.xz';
        default:
            return 'https://ffmpeg.org/download.html';
    }
}
