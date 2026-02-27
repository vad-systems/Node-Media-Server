"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
function getStreams(req, res, next) {
    let stats = {};
    this.sessions.forEach(function (session, id) {
        if (session.TAG !== 'trans') {
            return;
        }
        let { streamApp: app, streamName: name } = session.conf;
        if (!(0, lodash_1.get)(stats, [app, name])) {
            (0, lodash_1.set)(stats, [app, name], {
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
function delStream(req, res, next) {
    let transSession = this.sessions.get(req.params.id);
    if (transSession && transSession.TAG === 'trans') {
        transSession.stop();
        res.sendStatus(200);
    }
    else {
        res.sendStatus(404);
    }
}
exports.default = {
    getStreams,
    delStream,
};
