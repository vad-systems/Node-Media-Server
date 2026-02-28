"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
function getStreams(req, res, next) {
    let stats = {};
    this.sessions.forEach(function (session, id) {
        if (session.TAG !== 'relay') {
            return;
        }
        let { app, name } = session.conf;
        if (!(0, lodash_1.get)(stats, [app, name])) {
            (0, lodash_1.set)(stats, [app, name], {
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
function getStreamByID(req, res, next) {
    const relaySession = Array.from(this.sessions.values()).filter((session) => session.TAG === 'relay' &&
        req.params.id === session.id);
    const relays = relaySession.map((item) => ({
        app: item.conf.app,
        name: item.conf.name,
        path: item.conf.inPath,
        url: item.conf.ouPath,
        mode: item.conf.mode,
        ts: Math.floor(item.startTime / 1000),
        id: item.id,
    }));
    res.json(relays);
}
function getStreamByName(req, res, next) {
    const relaySession = Array.from(this.sessions.values()).filter((session) => session.TAG === 'relay' &&
        req.params.app === session.conf.app &&
        req.params.name === session.conf.name);
    const relays = relaySession.map((item) => ({
        app: item.conf.app,
        name: item.conf.name,
        url: item.conf.ouPath,
        mode: item.conf.mode,
        ts: Math.floor(item.startTime / 1000),
        id: item.id,
    }));
    res.json(relays);
}
function delStream(req, res, next) {
    let relaySession = this.sessions.get(req.params.id);
    if (relaySession) {
        relaySession.stop();
        res.sendStatus(200);
    }
    else {
        res.sendStatus(404);
    }
}
exports.default = {
    getStreams,
    getStreamByID,
    getStreamByName,
    delStream,
};
