class AVPacket {
    private _codec_id: number;
    private _codec_type: number;
    private _duration: number;
    private _flags: number;
    private _pts: number;
    private _dts: number;
    private _size: number;
    private _offset: number;
    private _data: Buffer;

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

    public get codec_id(): number {
        return this._codec_id;
    }

    public set codec_id(value: number) {
        this._codec_id = value;
    }

    public get codec_type(): number {
        return this._codec_type;
    }

    public set codec_type(value: number) {
        this._codec_type = value;
    }

    public get duration(): number {
        return this._duration;
    }

    public set duration(value: number) {
        this._duration = value;
    }

    public get flags(): number {
        return this._flags;
    }

    public set flags(value: number) {
        this._flags = value;
    }

    public get pts(): number {
        return this._pts;
    }

    public set pts(value: number) {
        this._pts = value;
    }

    public get dts(): number {
        return this._dts;
    }

    public set dts(value: number) {
        this._dts = value;
    }

    public get size(): number {
        return this._size;
    }

    public set size(value: number) {
        this._size = value;
    }

    public get offset(): number {
        return this._offset;
    }

    public set offset(value: number) {
        this._offset = value;
    }

    public get data(): Buffer {
        return this._data;
    }

    public set data(value: Buffer) {
        this._data = value;
    }
}

export default AVPacket;
