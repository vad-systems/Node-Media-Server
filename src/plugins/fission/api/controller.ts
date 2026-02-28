import { NextFunction, Request, Response } from 'express';
import { get, set } from 'lodash';
import { Context } from '@vad-systems/nms-shared';

function getStreams(this: Context, req: Request, res: Response, next: NextFunction) {
    let stats: any = {};
    this.sessions.forEach(function (session: any, id) {
        if (session.TAG !== 'fission') {
            return;
        }

        let { streamApp: app, streamName: name } = session.conf;

        if (!get(stats, [app, name])) {
            set(stats, [app, name], {
                fission: [],
            });
        }

        stats[app][name]['fission'].push({
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
    let fissionSession: any = this.sessions.get(req.params.id as string);
    if (fissionSession && fissionSession.TAG === 'fission') {
        fissionSession.stop();
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
}

export default {
    getStreams,
    delStream,
};
