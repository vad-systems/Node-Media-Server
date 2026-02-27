"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
function getStreams(req, res, next) {
    let stats = {};
    this.sessions.forEach(function (session, id) {
        if (session.TAG !== 'fission') {
            return;
        }
        let { streamApp: app, streamName: name } = session.conf;
        if (!(0, lodash_1.get)(stats, [app, name])) {
            (0, lodash_1.set)(stats, [app, name], {
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
function delStream(req, res, next) {
    let fissionSession = this.sessions.get(req.params.id);
    if (fissionSession && fissionSession.TAG === 'fission') {
        fissionSession.stop();
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
