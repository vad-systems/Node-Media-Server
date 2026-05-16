import { context } from '@vad-systems/nms-core';
import { NodeStaticServer } from '../NodeStaticServer.js';

export const getStatus = (req: any, res: any) => {
    const staticServer = (context.server as any).staticServer as NodeStaticServer;
    res.json(staticServer.getStatus());
};
