import { NextFunction, Request, Response } from 'express';
import { Context } from '@vad-systems/nms-shared';

export function pluginEnabled(pluginName: 'relay' | 'trans' | 'fission' | 'switch') {
    return function(this: Context, req: Request, res: Response, next: NextFunction) {
        const serverMap = {
            relay: this.server.relayServer,
            trans: this.server.transServer,
            fission: this.server.fissionServer,
            switch: this.server.switchServer,
        };

        const server = serverMap[pluginName];
        if (!server || !server.isRunning()) {
            res.status(503).json({ error: `${pluginName} server not enabled or stopped` });
            return;
        }
        next();
    };
}
