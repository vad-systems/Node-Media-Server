import { Request, Response } from 'express';

export function isSSERequest(req: Request): boolean {
    return req.headers.accept === 'text/event-stream';
}

export function startSSE(res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
}

export function sendSSEData(res: Response, data: any) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export async function streamStats(req: Request, res: Response, getData: () => any | Promise<any>, interval: number = 2000) {
    startSSE(res);

    const sendUpdate = async () => {
        try {
            const data = await getData();
            sendSSEData(res, data);
        } catch (e) {
            // Ignore errors in periodic updates
        }
    };

    await sendUpdate();
    const timer = setInterval(sendUpdate, interval);

    req.on('close', () => {
        clearInterval(timer);
    });
}
