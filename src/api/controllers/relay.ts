import { NextFunction, Request, Response } from 'express';
import { get, set } from 'lodash';
import { Context } from '@vad-systems/nms-shared';

function getStreams(this: Context, req: Request, res: Response, next: NextFunction) {
    let stats: any = {};
    this.sessions.forEach(function (session: any, id) {
        if (session.TAG !== 'relay') {
            return;
        }

        let { app, name } = session.conf;

        if (!get(stats, [app, name])) {
            set(stats, [app, name], {
                relays: [],
            });
        }

        stats[app][name]['relays'].push({
            app: app,
            name: name,
            path: session.conf.inPath,
            url: session.conf.ouPath,
            mode: session.conf.mode,
            ts: Math.floor(session.startTime / 1000),
            id: id,
        });
    });

    res.json(stats);
}

function getStreamByID(this: Context, req: Request, res: Response, next: NextFunction) {
    const relaySession = Array.from(this.sessions.values()).filter(
        (session: any) =>
            session.TAG === 'relay' &&
            req.params.id === session.id,
    );
    const relays = relaySession.map((item: any) => (
        {
            app: item.conf.app,
            name: item.conf.name,
            path: item.conf.inPath,
            url: item.conf.ouPath,
            mode: item.conf.mode,
            ts: Math.floor(item.startTime / 1000),
            id: item.id,
        }
    ));
    res.json(relays);
}

function getStreamByName(this: Context, req: Request, res: Response, next: NextFunction) {
    const relaySession = Array.from(this.sessions.values()).filter(
        (session: any) =>
            session.TAG === 'relay' &&
            req.params.app === session.conf.app &&
            req.params.name === session.conf.name,
    );
    const relays = relaySession.map((item: any) => (
        {
            app: item.conf.app,
            name: item.conf.name,
            url: item.conf.ouPath,
            mode: item.conf.mode,
            ts: Math.floor(item.startTime / 1000),
            id: item.id,
        }
    ));
    res.json(relays);
}

function delStream(this: Context, req: Request, res: Response, next: NextFunction) {
    let relaySession: any = this.sessions.get(req.params.id as string);
    if (relaySession) {
        relaySession.end();
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
}

export default {
    getStreams,
    getStreamByID,
    getStreamByName,
    delStream,
};
