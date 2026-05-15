"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BroadcastState = exports.SessionState = exports.LogType = void 0;
var LogType;
(function (LogType) {
    LogType[LogType["NONE"] = 0] = "NONE";
    LogType[LogType["ERROR"] = 1] = "ERROR";
    LogType[LogType["WARN"] = 2] = "WARN";
    LogType[LogType["NORMAL"] = 3] = "NORMAL";
    LogType[LogType["DEBUG"] = 4] = "DEBUG";
    LogType[LogType["FFDEBUG"] = 5] = "FFDEBUG";
})(LogType || (exports.LogType = LogType = {}));
var SessionState;
(function (SessionState) {
    SessionState["CONNECTING"] = "CONNECTING";
    SessionState["CONNECTED"] = "CONNECTED";
    SessionState["STARTING"] = "STARTING";
    SessionState["RUNNING"] = "RUNNING";
    SessionState["STOPPING"] = "STOPPING";
    SessionState["STOPPED"] = "STOPPED";
    SessionState["RESTARTING"] = "RESTARTING";
})(SessionState || (exports.SessionState = SessionState = {}));
var BroadcastState;
(function (BroadcastState) {
    BroadcastState["REGISTERING"] = "REGISTERING";
    BroadcastState["REGISTERED"] = "REGISTERED";
    BroadcastState["LIVE"] = "LIVE";
    BroadcastState["SWITCHING"] = "SWITCHING";
    BroadcastState["OFFLINE"] = "OFFLINE";
    BroadcastState["STOPPING"] = "STOPPING";
    BroadcastState["STOPPED"] = "STOPPED";
})(BroadcastState || (exports.BroadcastState = BroadcastState = {}));
