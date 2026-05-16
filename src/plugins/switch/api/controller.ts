import { Context } from '@vad-systems/nms-shared';
import { Request, Response } from 'express';
import NodeMediaServer from '../../../NodeMediaServer.js';
import { isSSERequest, streamStats } from '../../../api/sse.js';

function switchSource(this: Context, req: Request, res: Response) {
    const { path, source } = req.body;
    if (!path || !source) {
        return res.status(400).json({ error: 'path and source are required' });
    }

    const nms = this.server as NodeMediaServer;
    if (!nms.switchServer) {
        return res.status(503).json({ error: 'Switch server not enabled' });
    }

    const result = nms.switchServer.switch(path, source);
    if (result) {
        res.status(202).json({ status: 'Accepted' });
    } else {
        res.status(404).json({ error: 'Output path not found or source not valid for this output' });
    }
}

function getStatus(this: Context, req: Request, res: Response) {
    const fetchStatus = () => {
        const nms = this.server as NodeMediaServer;
        if (!nms.switchServer) {
            throw new Error('Switch server not enabled');
        }
        return nms.switchServer.getStatus();
    };

    if (isSSERequest(req)) {
        streamStats(req, res, fetchStatus, 2000);
        return;
    }

    try {
        res.json(fetchStatus());
    } catch (e: any) {
        res.status(503).json({ error: e.message });
    }
}

function stopTask(this: Context, req: Request, res: Response) {
    const { path } = req.body;
    if (!path) {
        return res.status(400).json({ error: 'path is required' });
    }

    const broadcast = this.broadcasts.get(path);
    if (broadcast) {
        broadcast.stop(true);
        res.json({ status: 'ok' });
    } else {
        res.status(404).json({ error: 'broadcast not found' });
    }
}

export default {
    switchSource,
    getStatus,
    stopTask
};
