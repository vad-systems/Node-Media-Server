import { Context } from '@vad-systems/nms-shared';
import { Request, Response } from 'express';
import NodeMediaServer from '../../../NodeMediaServer.js';

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
    const nms = this.server as NodeMediaServer;
    if (!nms.switchServer) {
        return res.status(503).json({ error: 'Switch server not enabled' });
    }

    const status = nms.switchServer.getStatus();
    res.json(status);
}

export default {
    switchSource,
    getStatus
};
