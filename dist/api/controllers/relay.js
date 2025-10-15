const { get, set } = require('lodash');
/**
 * get all relay tasks
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {*} next
 */
function getStreams(req, res, next) {
    let stats = {};
    this.sessions.forEach(function (session, id) {
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
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {*} next
 */
function getStreamByID(req, res, next) {
    const relaySession = Array.from(this.sessions.values()).filter((session) => session.constructor.name === 'NodeRelaySession' &&
        req.params.id === session.id);
    const relays = relaySession.map((item) => ({
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
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {*} next
 */
function getStreamByName(req, res, next) {
    const relaySession = Array.from(this.sessions.values()).filter((session) => session.constructor.name === 'NodeRelaySession' &&
        req.params.app === session.conf.app &&
        req.params.name === session.conf.name);
    const relays = relaySession.map((item) => ({
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
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {*} next
 */
function delStream(req, res, next) {
    let relaySession = this.sessions.get(req.params.id);
    if (relaySession) {
        relaySession.end();
        res.sendStatus(200);
    }
    else {
        res.sendStatus(404);
    }
}
module.exports = {
    getStreams,
    getStreamByID,
    getStreamByName,
    delStream,
};
