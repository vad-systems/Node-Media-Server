"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const nms_plugin_fission_1 = require("..");
function getStreams(req, res, next) {
    let stats = {};
    this.sessions.forEach(function (session, id) {
        if (!(session instanceof nms_plugin_fission_1.NodeFissionSession)) {
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
            state: session.state,
            path: session.conf.streamPath,
            id: id,
            ts: session.startTime,
            config: session.conf,
        });
    });
    res.json(stats);
}
function delStream(req, res, next) {
    let fissionSession = this.sessions.get(req.params.id);
    if (fissionSession instanceof nms_plugin_fission_1.NodeFissionSession) {
        fissionSession.stop(true);
        res.json({ status: 'ok' });
    }
    else {
        res.status(404).json({ error: 'fission session not found' });
    }
}
function restartStream(req, res, next) {
    let fissionSession = this.sessions.get(req.params.id);
    if (fissionSession instanceof nms_plugin_fission_1.NodeFissionSession) {
        fissionSession.restart();
        res.json({ status: 'ok' });
    }
    else {
        res.status(404).json({ error: 'fission session not found' });
    }
}
function startStream(req, res, next) {
    let fissionSession = this.sessions.get(req.params.id);
    if (fissionSession instanceof nms_plugin_fission_1.NodeFissionSession) {
        fissionSession.start(req.body);
        res.json({ status: 'ok' });
    }
    else {
        res.status(404).json({ error: 'fission session not found' });
    }
}
exports.default = {
    getStreams,
    delStream,
    restartStream,
    startStream,
};
