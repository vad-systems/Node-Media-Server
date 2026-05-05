"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pluginEnabled = pluginEnabled;
function pluginEnabled(pluginName) {
    return function (req, res, next) {
        const serverMap = {
            relay: this.server.relayServer,
            trans: this.server.transServer,
            fission: this.server.fissionServer,
            switch: this.server.switchServer,
        };
        const server = serverMap[pluginName];
        if (!server || !server.isRunning()) {
            res.status(503).json({ error: `${pluginName} server not enabled or stopped` });
            return;
        }
        next();
    };
}
