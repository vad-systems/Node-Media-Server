import { parseInt } from 'lodash';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import context from '../core/context.js';
import { decodeAmf0Data } from '../core/protocol/amf.js';
import { getAACProfileName, getAVCProfileName, readAACSpecificConfig, readAVCSpecificConfig } from '../core/protocol/av.js';
import AVPacket from '../core/protocol/AVPacket.js';
import Flv from '../core/protocol/flv.js';
import Rtmp from '../core/protocol/rtmp.js';
import { SessionConfig } from '../types/index.js';
import { NodeAvSession, Protocol } from './NodeAvSession.js';

class BroadcastServer<C, S extends NodeAvSession<C, SessionConfig<C>>> {
    private _publisher: S | null;
    private _subscribers: Map<string, S>;
    private flvHeader: Buffer;
    private flvMetaData: Buffer | null;
    private flvAudioHeader: Buffer | null;
    private flvVideoHeader: Buffer | null;
    private rtmpMetaData: Buffer | null;
    private rtmpAudioHeader: Buffer | null;
    private rtmpVideoHeader: Buffer | null;
    private flvGopCache: Set<Buffer> | null;
    private rtmpGopCache: Set<Buffer> | null;

    constructor() {
        this._publisher = null;
        this._subscribers = new Map();
        this.flvHeader = Flv.createHeader(true, true);
        this.flvMetaData = null;
        this.flvAudioHeader = null;
        this.flvVideoHeader = null;
        this.rtmpMetaData = null;
        this.rtmpAudioHeader = null;
        this.rtmpVideoHeader = null;
        this.flvGopCache = null;
        this.rtmpGopCache = null;
    }

    public get publisher(): S | null {
        return this._publisher;
    }

    public set publisher(value: S | null) {
        this._publisher = value;
    }

    public get subscribers(): Map<string, S> {
        return this._subscribers;
    }

    public set subscribers(value: Map<string, S>) {
        this._subscribers = value;
    }

    verifyAuth = (authKey: string, session: S) => {
        if (authKey === '') {
            return true;
        }
        let signStr = session.streamQuery?.sign as string; // TOOD
        if (signStr?.split('-')?.length !== 2) {
            return false;
        }
        let now = Date.now() / 1000 | 0;
        let exp = parseInt(signStr.split('-')[0]);
        let shv = signStr.split('-')[1];
        let str = session.streamPath + '-' + exp + '-' + authKey;
        if (exp < now) {
            return false;
        }
        let md5 = crypto.createHash('md5');
        let ohv = md5.update(str).digest('hex');
        return shv === ohv;
    };

    postPlay = (session: S) => {
        if (session.remoteIp !== '') {
            context.nodeEvent.emit('prePlay', session);
        }

        const config = context.configProvider.getConfig();

        if (config.auth?.play && session.remoteIp !== '') {
            if (!this.verifyAuth(config.auth?.secret, session)) {
                return `play stream ${session.streamPath} authentication verification failed`;
            }
        }

        if (session.remoteIp !== '') {
            context.nodeEvent.emit('postPlay', session);
        }

        switch (session.protocol) {
            case Protocol.FLV:
                session.sendBuffer(this.flvHeader);
                if (this.flvMetaData !== null) {
                    session.sendBuffer(this.flvMetaData);
                }
                if (this.flvAudioHeader !== null) {
                    session.sendBuffer(this.flvAudioHeader);
                }
                if (this.flvVideoHeader !== null) {
                    session.sendBuffer(this.flvVideoHeader);
                }
                if (this.flvGopCache !== null) {
                    this.flvGopCache.forEach((v) => {
                        session.sendBuffer(v);
                    });
                }
                break;
            case Protocol.RTMP:
                if (this.rtmpMetaData != null) {
                    session.sendBuffer(this.rtmpMetaData);
                }
                if (this.rtmpAudioHeader != null) {
                    session.sendBuffer(this.rtmpAudioHeader);
                }
                if (this.rtmpVideoHeader != null) {
                    session.sendBuffer(this.rtmpVideoHeader);
                }
                if (this.rtmpGopCache !== null) {
                    this.rtmpGopCache.forEach((v) => {
                        session.sendBuffer(v);
                    });
                }
        }

        session.startTime = Date.now();
        this._subscribers.set(session.id, session);
        return null;
    };

    donePlay = (session: S) => {
        session.endTime = Date.now();
        if (session.remoteIp !== '') {
            context.nodeEvent.emit('donePlay', session);
        }
        this._subscribers.delete(session.id);
    };

    postPublish = (session: S) => {
        context.nodeEvent.emit('prePublish', session);

        const config = context.configProvider.getConfig();

        if (config.auth?.publish) {
            if (!this.verifyAuth(config.auth?.secret, session)) {
                return `publish stream ${session.streamPath} authentication verification failed`;
            }
        }

        if (this._publisher == null) {
            session.startTime = Date.now();
            this._publisher = session;
        } else {
            return `streamPath=${session.streamPath} already has a publisher`;
        }
        context.nodeEvent.emit('postPublish', session);
        return null;
    };

    donePublish = (session: S) => {
        if (session === this._publisher) {
            session.endTime = Date.now();
            context.nodeEvent.emit('donePublish', session);
            this._publisher = null;
            this.flvMetaData = null;
            this.flvAudioHeader = null;
            this.flvVideoHeader = null;
            this.rtmpMetaData = null;
            this.rtmpAudioHeader = null;
            this.rtmpVideoHeader = null;
            this.flvGopCache?.clear();
            this.rtmpGopCache?.clear();
        }
    };

    broadcastMessage = (packet: AVPacket) => {
        if (packet.flags == 5) {
            let metadata = decodeAmf0Data(packet.data);
            if (this._publisher && metadata.cmd === '@setDataFrame' && metadata.dataObj !== null) {
                this._publisher.audioCodec = metadata.dataObj.audiocodecid;
                this._publisher.audioChannels = metadata.dataObj.stereo ? 2 : 1;
                this._publisher.audioSamplerate = metadata.dataObj.audiosamplerate;
                this._publisher.audioDatarate = metadata.dataObj.audiodatarate;
                this._publisher.videoCodec = metadata.dataObj.videocodecid;
                this._publisher.videoWidth = metadata.dataObj.width;
                this._publisher.videoHeight = metadata.dataObj.height;
                this._publisher.videoFramerate = metadata.dataObj.framerate;
                this._publisher.videoDatarate = metadata.dataObj.videodatarate;
            }
        }

        const flvMessage = Flv.createMessage(packet);
        const rtmpMessage = Rtmp.createMessage(packet);

        switch (packet.flags) {
            case 0:
                this.flvAudioHeader = Buffer.from(flvMessage);
                this.rtmpAudioHeader = Buffer.from(rtmpMessage);
                let audioInfo = readAACSpecificConfig(packet.data);
                this.publisher.audioProfile = getAACProfileName(audioInfo);
                break;
            case 1:
                this.flvGopCache?.add(flvMessage);
                this.rtmpGopCache?.add(rtmpMessage);
                break;
            case 2:
                this.flvVideoHeader = Buffer.from(flvMessage);
                this.rtmpVideoHeader = Buffer.from(rtmpMessage);
                let videoInfo = readAVCSpecificConfig(packet.data);
                this.publisher.videoProfile = getAVCProfileName(videoInfo);
                break;
            case 3:
                this.flvGopCache?.clear();
                this.rtmpGopCache?.clear();
                this.flvGopCache = new Set();
                this.rtmpGopCache = new Set();
                this.flvGopCache.add(flvMessage);
                this.rtmpGopCache.add(rtmpMessage);
                break;
            case 4:
                this.flvGopCache?.add(flvMessage);
                this.rtmpGopCache?.add(rtmpMessage);
                break;
            case 5:
                this.flvMetaData = Buffer.from(flvMessage);
                this.rtmpMetaData = Buffer.from(rtmpMessage);
                break;
        }

        if (this.flvGopCache && this.flvGopCache.size > 4096) {
            this.flvGopCache.clear();
        }

        if (this.rtmpGopCache && this.rtmpGopCache.size > 4096) {
            this.rtmpGopCache.clear();
        }

        this._subscribers.forEach((v, k) => {
            switch (v.protocol) {
                case Protocol.FLV:
                    v.sendBuffer(flvMessage);
                    break;
                case Protocol.RTMP:
                    v.sendBuffer(rtmpMessage);
                    break;
            }
        });
    };
}

export default BroadcastServer;
