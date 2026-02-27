import { spawn } from 'child_process';
import context from './context.js';

function generateNewSessionID() {
    let sessionID = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWKYZ0123456789';

    const numPossible = possible.length;
    do {
        for (let i = 0; i < 8; i++) {
            sessionID += possible.charAt((
                Math.random() * numPossible
            ) | 0);
        }
    }
    while (context.sessions.has(sessionID));

    return sessionID;
}

function getFFmpegVersion(ffpath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        let ffmpeg_exec = spawn(ffpath, ['-version']);
        let result = '';

        ffmpeg_exec.on('error', (e) => {
            reject(e);
        });

        ffmpeg_exec.stdout.on('data', (data) => {
            try {
                result += data;
            } catch (e) {
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

export {
    generateNewSessionID,
    getFFmpegVersion,
    getFFmpegUrl,
};
