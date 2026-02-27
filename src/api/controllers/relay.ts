import { get, set } from 'lodash';
import { NextFunction, Request, Response } from 'express';
import { Context } from '../../types/index.js';

/**
 * get all relay tasks
 */
function getStreams(this: Context, req: Request, res: Response, next: NextFunction) {
    let stats: any = {};
    this.sessions.forEach(function (session: any, id) {
        if (session.constructor.name !== 'NodeRelaySession') {
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
            ts: session.ts,
            id: id,
        });
    });

    res.json(stats);
}

/**
 * get relay task by id
 */
function getStreamByID(this: Context, req: Request, res: Response, next: NextFunction) {
    const relaySession = Array.from(this.sessions.values()).filter(
        (session: any) =>
            session.constructor.name === 'NodeRelaySession' &&
            req.params.id === session.id
    );
    const relays = relaySession.map((item: any) => ({
        app: item.conf.app,
        name: item.conf.name,
        path: item.conf.inPath,
        url: item.conf.ouPath,
        mode: item.conf.mode,
        ts: item.ts,
        id: item.id,
    }));
    res.json(relays);
}

/**
 * get relay task by name
 */
function getStreamByName(this: Context, req: Request, res: Response, next: NextFunction) {
    const relaySession = Array.from(this.sessions.values()).filter(
        (session: any) =>
            session.constructor.name === 'NodeRelaySession' &&
            req.params.app === session.conf.app &&
            req.params.name === session.conf.name
    );
    const relays = relaySession.map((item: any) => ({
        app: item.conf.app,
        name: item.conf.name,
        url: item.conf.ouPath,
        mode: item.conf.mode,
        ts: item.ts,
        id: item.id,
    }));
    res.json(relays);
}

/**
 * delete relay task
 */
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
