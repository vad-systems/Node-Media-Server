"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const asRegExp = (pattern) => {
    if (pattern instanceof RegExp) {
        return pattern;
    }
    if (typeof pattern === typeof undefined) {
        return undefined;
    }
    return new RegExp(pattern, 'g');
};
exports.default = asRegExp;
