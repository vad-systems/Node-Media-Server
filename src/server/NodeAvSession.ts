import { ParsedUrlQuery } from 'querystring';
import { SessionConfig } from '../types/index.js';
import { NodeSession } from './NodeSession.js';

export enum Protocol {
    RTMP = 'rtmp',
    FLV = 'flv',
}

abstract class NodeAvSession<A, T extends SessionConfig<A>> extends NodeSession<A, T> {
    public readonly protocol: Protocol;

    private _streamPath: string | null = null;
    private _streamQuery: ParsedUrlQuery | null = null;

    private _audioCodec: string = null;
    private _audioChannels: number = null;
    private _audioSamplerate: number = null;
    private _audioDatarate: number = null;
    private _videoCodec: string = null;
    private _videoWidth: number = null;
    private _videoHeight: number = null;
    private _videoFramerate: number = null;
    private _videoDatarate: number = null;

    private _endTime: number | null = null;

    protected constructor(conf: T, remoteIp: string, protocol: Protocol) {
        super(conf, remoteIp, protocol.toString());
        this.protocol = protocol;
    }

    public set streamPath(path: string) {
        this._streamPath = path;
    }
    public get streamPath() {
        return this._streamPath;
    }

    public set streamQuery(query: ParsedUrlQuery) {
        this._streamQuery = query;
    }
    public get streamQuery() {
        return this._streamQuery;
    }

    public set audioCodec(codec: string) {
        this._audioCodec = codec;
    }
    public get audioCodec() {
        return this._audioCodec;
    }

    public set audioChannels(channels: number) {
        this._audioChannels = channels;
    }
    public get audioChannels() {
        return this._audioChannels;
    }

    public set audioSamplerate(samplerate: number) {
        this._audioSamplerate = samplerate;
    }
    public get audioSamplerate() {
        return this._audioSamplerate;
    }

    public set audioDatarate(datarate: number) {
        this._audioDatarate = datarate;
    }
    public get audioDatarate() {
        return this._audioDatarate;
    }

    public set videoCodec(codec: string) {
        this._videoCodec = codec;
    }
    public get videoCodec() {
        return this._videoCodec;
    }

    public set videoWidth(width: number) {
        this._videoWidth = width;
    }
    public get videoWidth() {
        return this._videoWidth;
    }

    public set videoHeight(height: number) {
        this._videoHeight = height;
    }
    public get videoHeight() {
        return this._videoHeight;
    }

    public set videoFramerate(framerate: number) {
        this._videoFramerate = framerate;
    }
    public get videoFramerate() {
        return this._videoFramerate;
    }

    public set videoDatarate(datarate: number) {
        this._videoDatarate = datarate;
    }
    public get videoDatarate() {
        return this._videoDatarate;
    }

    public set endTime(time: number) {
        this._endTime = time;
    }
    public get endTime() {
        return this._endTime;
    }
}

export { NodeAvSession };
