const NodeCoreUtils = require('./node_core_utils');
const EventEmitter = require('events');

class NodeSession extends EventEmitter {
    conf = null;
    id = null;

    constructor(conf) {
        super();
        this.conf = conf;
        this.id = NodeCoreUtils.generateNewSessionID();
    }
}

module.exports = NodeSession;
