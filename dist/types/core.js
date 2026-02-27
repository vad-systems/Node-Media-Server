"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogType = void 0;
var LogType;
(function (LogType) {
    LogType[LogType["NONE"] = 0] = "NONE";
    LogType[LogType["ERROR"] = 1] = "ERROR";
    LogType[LogType["WARN"] = 2] = "WARN";
    LogType[LogType["NORMAL"] = 3] = "NORMAL";
    LogType[LogType["DEBUG"] = 4] = "DEBUG";
    LogType[LogType["FFDEBUG"] = 5] = "FFDEBUG";
})(LogType || (exports.LogType = LogType = {}));
