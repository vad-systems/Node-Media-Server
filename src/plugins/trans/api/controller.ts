import { NextFunction, Request, Response } from 'express';
import { get, set } from 'lodash';
import { Context } from '@vad-systems/nms-shared';
import { NodeTransSession } from '@vad-systems/nms-plugin-trans';

function getStreams(this: Context, req: Request, res: Response, next: NextFunction) {
    let stats: any = {};
    this.sessions.forEach(function (session, id) {
        if (!(
            session instanceof NodeTransSession
        )) {
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
            state: session.state,
            path: session.conf.streamPath,
            id: id,
            ts: session.startTime,
            config: session.conf,
        });
    });

    res.json(stats);
}

function delStream(this: Context, req: Request, res: Response, next: NextFunction) {
    let transSession = this.sessions.get(req.params.id as string);
    if (transSession instanceof NodeTransSession) {
        transSession.stop(true);
        res.json({ status: 'ok' });
    } else {
        res.status(404).json({ error: 'trans session not found' });
    }
}

function restartStream(this: Context, req: Request, res: Response, next: NextFunction) {
    let transSession = this.sessions.get(req.params.id as string);
    if (transSession instanceof NodeTransSession) {
        transSession.restart();
        res.json({ status: 'ok' });
    } else {
        res.status(404).json({ error: 'trans session not found' });
    }
}

function startStream(this: Context, req: Request, res: Response, next: NextFunction) {
    let transSession = this.sessions.get(req.params.id as string);
    if (transSession instanceof NodeTransSession) {
        transSession.start(req.body);
        res.json({ status: 'ok' });
    } else {
        res.status(404).json({ error: 'trans session not found' });
    }
}

export default {
    getStreams,
    delStream,
    restartStream,
    startStream,
};
