import { amf, av, AVPacket, Flv, Rtmp } from '@vad-systems/nms-protocol';
import { SessionConfig } from '@vad-systems/nms-shared';
import { Buffer } from 'node:buffer';
import { BaseAvSession } from './BaseAvSession.js';
import { BroadcastServer } from './BroadcastServer.js';
import { Protocol } from './Protocol.js';

export class AvBroadcastServer<C, S extends BaseAvSession<C, SessionConfig<C>>> extends BroadcastServer<C, S> {
    protected flvHeader: Buffer;
    protected flvMetaData: Buffer | null;
    protected flvAudioHeader: Buffer | null;
    protected flvVideoHeader: Buffer | null;
    protected rtmpMetaData: Buffer | null;
    protected rtmpAudioHeader: Buffer | null;
    protected rtmpVideoHeader: Buffer | null;
    protected flvGopCache: Set<Buffer> | null;
    protected rtmpGopCache: Set<Buffer> | null;

    constructor() {
        super();
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

    public postPlay(session: S) {
        super.postPlay(session);

        switch (session.protocol) {
            case Protocol.HTTP_FLV:
            case Protocol.WS_FLV:
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
    };

    public donePublish = (session: S) => {
        if (session === this.publisher) {
            super.donePublish(session);

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

    public broadcastMessage(packet: AVPacket) {
        if (packet.flags == 5) {
            let metadata = amf.decodeAmf0Data(packet.data);
            if (this.publisher && metadata.cmd === '@setDataFrame' && metadata.dataObj !== null) {
                this.logger.debug('[metadata frame]', metadata);
                this.publisher.audioCodec = metadata.dataObj.audiocodecid;
                this.publisher.audioChannels = metadata.dataObj.stereo ? 2 : 1;
                this.publisher.audioSamplerate = metadata.dataObj.audiosamplerate;
                this.publisher.audioDatarate = metadata.dataObj.audiodatarate;
                this.publisher.videoCodec = metadata.dataObj.videocodecid;
                this.publisher.videoWidth = metadata.dataObj.width;
                this.publisher.videoHeight = metadata.dataObj.height;
                this.publisher.videoFramerate = metadata.dataObj.framerate;
                this.publisher.videoDatarate = metadata.dataObj.videodatarate;
            }
        }

        const flvMessage = Flv.createMessage(packet);
        const rtmpMessage = Rtmp.createMessage(packet);

        switch (packet.flags) {
            case 0:
                this.flvAudioHeader = Buffer.from(flvMessage);
                this.rtmpAudioHeader = Buffer.from(rtmpMessage);
                let audioInfo = av.readAACSpecificConfig(packet.data);
                this.publisher.audioProfile = av.getAACProfileName(audioInfo);
                break;
            case 1:
                this.flvGopCache?.add(flvMessage);
                this.rtmpGopCache?.add(rtmpMessage);
                break;
            case 2:
                this.flvVideoHeader = Buffer.from(flvMessage);
                this.rtmpVideoHeader = Buffer.from(rtmpMessage);
                let videoInfo = av.readAVCSpecificConfig(packet.data);
                this.publisher.videoProfile = av.getAVCProfileName(videoInfo);
                this.publisher.videoLevel = videoInfo.level;
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

        this.subscribers.forEach((v, k) => {
            if (!(
                v instanceof BaseAvSession
            )) {
                return;
            }

            switch (v.protocol) {
                case Protocol.HTTP_FLV:
                case Protocol.WS_FLV:
                    v.sendBuffer(flvMessage);
                    break;
                case Protocol.RTMP:
                    v.sendBuffer(rtmpMessage);
                    break;
                case Protocol.RAW:
                    v.sendBuffer(packet);
                    break;
            }
        });
    };
}

