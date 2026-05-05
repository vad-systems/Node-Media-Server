"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const nms_plugin_relay_1 = require("..");
function getStreams(req, res, next) {
    let stats = {};
    this.sessions.forEach(function (session, id) {
        if (!(session instanceof nms_plugin_relay_1.NodeRelaySession)) {
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
            ts: session.startTime,
            id: id,
        });
    });
    res.json(stats);
}
function getStreamByID(req, res, next) {
    const relaySession = Array.from(this.sessions.values()).filter((session) => session instanceof nms_plugin_relay_1.NodeRelaySession &&
        req.params.id === session.id);
    const relays = relaySession.map((item) => ({
        app: item.conf.app,
        name: item.conf.name,
        path: item.conf.inPath,
        url: item.conf.ouPath,
        mode: item.conf.mode,
        ts: item.startTime,
        id: item.id,
    }));
    res.json(relays);
}
function getStreamByName(req, res, next) {
    const relaySession = Array.from(this.sessions.values()).filter((session) => session instanceof nms_plugin_relay_1.NodeRelaySession &&
        req.params.app === session.conf.app &&
        req.params.name === session.conf.name);
    const relays = relaySession.map((item) => ({
        app: item.conf.app,
        name: item.conf.name,
        url: item.conf.ouPath,
        mode: item.conf.mode,
        ts: item.startTime,
        id: item.id,
    }));
    res.json(relays);
}
function delStream(req, res, next) {
    let relaySession = this.sessions.get(req.params.id);
    if (relaySession instanceof nms_plugin_relay_1.NodeRelaySession) {
        relaySession.stop();
        res.sendStatus(200);
    }
    else {
        res.sendStatus(404);
    }
}
function restartStream(req, res, next) {
    let relaySession = this.sessions.get(req.params.id);
    if (relaySession instanceof nms_plugin_relay_1.NodeRelaySession) {
        relaySession.restart();
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
    restartStream,
};
