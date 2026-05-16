import { context } from '@vad-systems/nms-core';
import { NodeStaticServer } from '../NodeStaticServer.js';
import { isSSERequest, streamStats } from '../../../api/sse.js';

export const getStatus = (req: any, res: any) => {
    const fetchStatus = () => {
        const staticServer = (context.server as any).staticServer as NodeStaticServer;
        return staticServer.getStatus();
    };

    if (isSSERequest(req)) {
        streamStats(req, res, fetchStatus, 2000);
        return;
    }

    res.json(fetchStatus());
};
