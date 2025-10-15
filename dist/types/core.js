"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogType = void 0;
var LogType;
(function (LogType) {
    LogType[LogType["NONE"] = 0] = "NONE";
    LogType[LogType["ERROR"] = 1] = "ERROR";
    LogType[LogType["NORMAL"] = 2] = "NORMAL";
    LogType[LogType["DEBUG"] = 3] = "DEBUG";
    LogType[LogType["FFDEBUG"] = 4] = "FFDEBUG";
})(LogType || (exports.LogType = LogType = {}));
