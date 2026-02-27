import { NextFunction, Request, Response } from 'express';
import { get, set } from 'lodash';
import { Context } from '../../types/index.js';

function getStreams(this: Context, req: Request, res: Response, next: NextFunction) {
    let stats: any = {};
    this.sessions.forEach(function (session: any, id) {
        if (session.TAG !== 'trans') {
            return;
        }

        let { streamApp: app, streamName: name } = session.conf;

        if (!get(stats, [app, name])) {
            set(stats, [app, name], {
                trans: [],
            });
        }

        stats[app][name]['trans'].push({
            app: app,
            name: name,
            path: session.conf.streamPath,
            id: id,
            ts: Math.floor(session.startTime / 1000),
            config: session.conf,
        });
    });

    res.json(stats);
}

function delStream(this: Context, req: Request, res: Response, next: NextFunction) {
    let transSession: any = this.sessions.get(req.params.id as string);
    if (transSession && transSession.TAG === 'trans') {
        transSession.stop();
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
}

export default {
    getStreams,
    delStream,
};
