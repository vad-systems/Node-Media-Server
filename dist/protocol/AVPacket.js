"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AVPacket {
    _codec_id;
    _codec_type;
    _duration;
    _flags;
    _pts;
    _dts;
    _size;
    _offset;
    _data;
    constructor() {
        this._codec_id = 0;
        this._codec_type = 0;
        this._duration = 0;
        this._flags = 0;
        this._pts = 0;
        this._dts = 0;
        this._size = 0;
        this._offset = 0;
        this._data = Buffer.alloc(0);
    }
    get codec_id() {
        return this._codec_id;
    }
    set codec_id(value) {
        this._codec_id = value;
    }
    get codec_type() {
        return this._codec_type;
    }
    set codec_type(value) {
        this._codec_type = value;
    }
    get duration() {
        return this._duration;
    }
    set duration(value) {
        this._duration = value;
    }
    get flags() {
        return this._flags;
    }
    set flags(value) {
        this._flags = value;
    }
    get pts() {
        return this._pts;
    }
    set pts(value) {
        this._pts = value;
    }
    get dts() {
        return this._dts;
    }
    set dts(value) {
        this._dts = value;
    }
    get size() {
        return this._size;
    }
    set size(value) {
        this._size = value;
    }
    get offset() {
        return this._offset;
    }
    set offset(value) {
        this._offset = value;
    }
    get data() {
        return this._data;
    }
    set data(value) {
        this._data = value;
    }
}
exports.default = AVPacket;
