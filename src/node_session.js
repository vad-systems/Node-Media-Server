const NodeCoreUtils = require('./node_core_utils');
const EventEmitter = require('events');
const _ = require("lodash");

class NodeSession extends EventEmitter {
    conf = null;
    id = null;

    constructor(conf) {
        super();
        this.conf = _.cloneDeep(conf);
        this.id = NodeCoreUtils.generateNewSessionID();
    }
}

module.exports = NodeSession;
