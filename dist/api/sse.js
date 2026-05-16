"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSSERequest = isSSERequest;
exports.startSSE = startSSE;
exports.sendSSEData = sendSSEData;
exports.streamStats = streamStats;
function isSSERequest(req) {
    return req.headers.accept === 'text/event-stream';
}
function startSSE(res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
}
function sendSSEData(res, data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}
async function streamStats(req, res, getData, interval = 2000) {
    startSSE(res);
    const sendUpdate = async () => {
        try {
            const data = await getData();
            sendSSEData(res, data);
        }
        catch (e) {
            // Ignore errors in periodic updates
        }
    };
    await sendUpdate();
    const timer = setInterval(sendUpdate, interval);
    req.on('close', () => {
        clearInterval(timer);
    });
}
