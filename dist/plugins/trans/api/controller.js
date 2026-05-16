"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const nms_plugin_trans_1 = require("..");
const sse_js_1 = require("../../../api/sse.js");
function getStreams(req, res, next) {
    const fetchStats = () => {
        let stats = {};
        this.sessions.forEach(function (session, id) {
            if (!(session instanceof nms_plugin_trans_1.NodeTransSession)) {
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
                state: session.state,
                path: session.conf.streamPath,
                id: id,
                ts: session.startTime,
                config: session.conf,
            });
        });
        return stats;
    };
    if ((0, sse_js_1.isSSERequest)(req)) {
        (0, sse_js_1.streamStats)(req, res, fetchStats, 2000);
        return;
    }
    res.json(fetchStats());
}
function delStream(req, res, next) {
    let transSession = this.sessions.get(req.params.id);
    if (transSession instanceof nms_plugin_trans_1.NodeTransSession) {
        transSession.stop(true);
        res.json({ status: 'ok' });
    }
    else {
        res.status(404).json({ error: 'trans session not found' });
    }
}
function restartStream(req, res, next) {
    let transSession = this.sessions.get(req.params.id);
    if (transSession instanceof nms_plugin_trans_1.NodeTransSession) {
        transSession.restart();
        res.json({ status: 'ok' });
    }
    else {
        res.status(404).json({ error: 'trans session not found' });
    }
}
function startStream(req, res, next) {
    let transSession = this.sessions.get(req.params.id);
    if (transSession instanceof nms_plugin_trans_1.NodeTransSession) {
        transSession.start(req.body);
        res.json({ status: 'ok' });
    }
    else {
        res.status(404).json({ error: 'trans session not found' });
    }
}
exports.default = {
    getStreams,
    delStream,
    restartStream,
    startStream,
};
