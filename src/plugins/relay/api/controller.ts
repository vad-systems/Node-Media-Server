import { NextFunction, Request, Response } from 'express';
import { get, set } from 'lodash';
import { Context } from '@vad-systems/nms-shared';
import { NodeRelaySession } from '@vad-systems/nms-plugin-relay';

function getStreams(this: Context, req: Request, res: Response, next: NextFunction) {
    let stats: any = {};
    this.sessions.forEach(function (session, id) {
        if (!(
            session instanceof NodeRelaySession
        )) {
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
            ts: session.startTime,
            id: id,
        });
    });

    res.json(stats);
}

function getStreamByID(this: Context, req: Request, res: Response, next: NextFunction) {
    const relaySession = Array.from(this.sessions.values()).filter(
        (session) =>
            session instanceof NodeRelaySession &&
            req.params.id === session.id,
    ) as NodeRelaySession[];

    const relays = relaySession.map((item) => (
        {
            app: item.conf.app,
            name: item.conf.name,
            path: item.conf.inPath,
            url: item.conf.ouPath,
            mode: item.conf.mode,
            ts: item.startTime,
            id: item.id,
        }
    ));

    res.json(relays);
}

function getStreamByName(this: Context, req: Request, res: Response, next: NextFunction) {
    const relaySession = Array.from(this.sessions.values()).filter(
        (session) =>
            session instanceof NodeRelaySession &&
            req.params.app === session.conf.app &&
            req.params.name === session.conf.name,
    ) as NodeRelaySession[];

    const relays = relaySession.map((item) => (
        {
            app: item.conf.app,
            name: item.conf.name,
            url: item.conf.ouPath,
            mode: item.conf.mode,
            ts: item.startTime,
            id: item.id,
        }
    ));

    res.json(relays);
}

function delStream(this: Context, req: Request, res: Response, next: NextFunction) {
    let relaySession = this.sessions.get(req.params.id as string);
    if (relaySession instanceof NodeRelaySession) {
        relaySession.stop();
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
}

function restartStream(this: Context, req: Request, res: Response, next: NextFunction) {
    let relaySession = this.sessions.get(req.params.id as string);
    if (relaySession instanceof NodeRelaySession) {
        relaySession.restart();
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
    restartStream,
};
