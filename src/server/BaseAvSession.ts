import context from '../core/context.js';
import AVPacket from '../core/protocol/AVPacket.js';
import { FlvAudioCodec, FlvVideoCodec } from '../core/protocol/flv.js';
import { SessionConfig } from '../types/index.js';
import AvBroadcastServer from './AvBroadcastServer.js';
import { NodeSession } from './NodeSession.js';
import { Protocol } from './Protocol.js';

abstract class BaseAvSession<A, T extends SessionConfig<A>> extends NodeSession<A, T> {
    public readonly protocol: Protocol;

    private _audioCodec: FlvAudioCodec = null;
    private _audioProfile: string = null;
    private _audioChannels: number = null;
    private _audioSamplerate: number = null;
    private _audioDatarate: number = null;
    private _videoCodec: FlvVideoCodec = null;
    private _videoProfile: string = null;
    private _videoWidth: number = null;
    private _videoHeight: number = null;
    private _videoFramerate: number = null;
    private _videoDatarate: number = null;

    protected constructor(conf: T, remoteIp: string, protocol: Protocol) {
        super(conf, remoteIp, protocol.toString());
        this.protocol = protocol;

        this.onPlay = this.onPlay.bind(this);
        this.onPush = this.onPush.bind(this);
        this.onClose = this.onClose.bind(this);
        this.onError = this.onError.bind(this);
        this.onPacket = this.onPacket.bind(this);
    }

    protected get avBroadcast(): AvBroadcastServer<any, any> {
        return this.broadcast as AvBroadcastServer<any, any>;
    }

    protected onPlay() {
        try {
            this.initBroadcast();
            this.broadcast.postPlay(this);
        } catch (err: any) {
            this.logger.warn(`${this.remoteIp} play ${this.streamPath} error, ${err}`);
            this.stop();
            return;
        }
        this.isPublisher = false;
        this.logger.log(`${this.remoteIp} start play ${this.streamPath}`);
    }

    protected onPush() {
        try {
            this.initBroadcast();
            this.broadcast.postPublish(this);
        } catch (err: any) {
            this.logger.warn(`${this.remoteIp} push ${this.streamPath} error, ${err}`);
            this.stop();
            return;
        }
        this.isPublisher = true;
        this.logger.log(`${this.remoteIp} start push ${this.streamPath}`);
    }

    protected onClose() {
        this.logger.log(`close`);
        if (this.isPublisher) {
            this.broadcast?.donePublish(this);
        } else {
            this.broadcast?.donePlay(this);
        }
        context.nodeEvent.emit('doneConnect', this);
        context.sessions.delete(this.id);
    }

    protected onError(err: any) {
        this.logger.error(`${this.remoteIp} socket error, ${err}`);
    }

    protected onPacket(packet: AVPacket) {
        this.avBroadcast?.broadcastMessage(packet);
    }

    private initBroadcast() {
        if (!this.broadcast) {
            this.broadcast = context.broadcasts.get(this.streamPath) as AvBroadcastServer<any, any> ?? new AvBroadcastServer();
            context.broadcasts.set(this.streamPath, this.broadcast);
        }
    }

    public set audioCodec(codec: FlvAudioCodec) {
        this._audioCodec = codec;
    }

    public get audioCodec() {
        return this._audioCodec;
    }

    public set audioProfile(profile: string) {
        this._audioProfile = profile;
    }

    public get audioProfile() {
        return this._audioProfile;
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

    public set videoCodec(codec: FlvVideoCodec) {
        this._videoCodec = codec;
    }

    public get videoCodec() {
        return this._videoCodec;
    }

    public set videoProfile(profile: string) {
        this._videoProfile = profile;
    }

    public get videoProfile() {
        return this._videoProfile;
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
}

export { BaseAvSession };
