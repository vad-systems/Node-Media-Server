"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwitchableBroadcastServer = void 0;
const nms_core_1 = require("../../core");
const nms_protocol_1 = require("../../protocol");
const nms_server_1 = require("../../server");
const nms_shared_1 = require("../../shared");
class SwitchableBroadcastServer extends nms_server_1.AvBroadcastServer {
    activeSourcePath = null;
    pendingSourcePath = null;
    timestampOffset = 0;
    lastOutputDts = 0;
    switching = false;
    switchTimer = null;
    forceSwitchNext = false;
    manualSwitch = false;
    activeSession = null;
    constructor() {
        super();
    }
    get activeSource() {
        return this.activeSourcePath;
    }
    get currentSession() {
        return this.activeSession;
    }
    get pendingSource() {
        return this.pendingSourcePath;
    }
    get isSwitching() {
        return this.switching;
    }
    get isManualSwitch() {
        return this.manualSwitch;
    }
    setInitialSource(sourcePath) {
        this.activeSourcePath = sourcePath;
        this.manualSwitch = false;
        // Optionally pre-load headers from initial source if it's already publishing
        this.sendSourceHeaders(sourcePath);
    }
    handleSourcePacket(sourcePath, packet, session) {
        if (this.switching && sourcePath === this.pendingSourcePath) {
            // Check for video keyframe to perform cut-over or if we are forcing it
            if (packet.flags === 3 || this.forceSwitchNext) {
                this.cutOver(sourcePath, packet, session);
            }
        }
        if (sourcePath !== this.activeSourcePath || session !== this.activeSession) {
            return;
        }
        const adjustedPacket = this.adjustTimestamp(packet);
        // Track last output DTS to calculate offset later
        this.lastOutputDts = adjustedPacket.dts;
        session.forwardPacket(adjustedPacket);
    }
    adjustTimestamp(packet) {
        const newPacket = new nms_protocol_1.AVPacket();
        newPacket.codec_id = packet.codec_id;
        newPacket.codec_type = packet.codec_type;
        newPacket.duration = packet.duration;
        newPacket.flags = packet.flags;
        newPacket.size = packet.size;
        newPacket.offset = packet.offset;
        newPacket.data = packet.data;
        newPacket.dts = packet.dts + this.timestampOffset;
        newPacket.pts = packet.pts + this.timestampOffset;
        return newPacket;
    }
    restart() {
        this.logger.log(`[Switch] restarting broadcast`);
        this.cancelSwitch();
        this.activeSourcePath = null;
        this.pendingSourcePath = null;
        this.manualSwitch = false;
        this.timestampOffset = 0;
        this.lastOutputDts = 0;
        if (this.activeSession) {
            this.activeSession.unsetAsPublisher();
            this.activeSession = null;
        }
    }
    switchSource(newSourcePath, timeout = 0, isManual = true, force = false) {
        if (newSourcePath === this.activeSourcePath && this.activeSession) {
            this.cancelSwitch();
            this.manualSwitch = isManual;
            return;
        }
        this.cancelSwitch();
        if (newSourcePath === null) {
            if (this.activeSession) {
                this.activeSession.unsetAsPublisher();
                this.activeSession = null;
            }
            this.activeSourcePath = null;
            this.manualSwitch = false;
            this.logger.log(`[Switch] broadcast source cleared`);
            return;
        }
        nms_core_1.context.nodeEvent.emit('preSwitch', this);
        this.pendingSourcePath = newSourcePath;
        this.switching = true;
        this.state = nms_shared_1.BroadcastState.SWITCHING;
        this.forceSwitchNext = force;
        this.manualSwitch = isManual;
        this.logger.log(`[Switch] switching pending: ${this.activeSourcePath} -> ${newSourcePath}${force ? ' (FORCED)' : ''}`);
        if (timeout > 0) {
            this.switchTimer = setTimeout(() => {
                this.logger.log(`[Switch] switch timeout reached, forcing cut-over to ${newSourcePath}`);
                this.forceSwitchNext = true;
            }, timeout);
        }
    }
    cancelSwitch() {
        if (this.switchTimer) {
            clearTimeout(this.switchTimer);
            this.switchTimer = null;
        }
        this.switching = false;
        this.pendingSourcePath = null;
        this.forceSwitchNext = false;
        if (this.state === nms_shared_1.BroadcastState.SWITCHING) {
            this.state = (this.activeSession && this.activeSourcePath) ? nms_shared_1.BroadcastState.LIVE : nms_shared_1.BroadcastState.OFFLINE;
        }
    }
    notifySourceOffline(sourcePath) {
        if (sourcePath === this.activeSourcePath) {
            this.logger.log(`[Switch] active source ${sourcePath} went offline`);
            if (this.switching && this.pendingSourcePath) {
                this.logger.log(`[Switch] forcing immediate cut-over to ${this.pendingSourcePath} due to active source failure`);
                this.forceSwitchNext = true;
            }
        }
        else if (sourcePath === this.pendingSourcePath) {
            this.logger.log(`[Switch] pending source ${sourcePath} went offline, cancelling switch`);
            this.cancelSwitch();
        }
    }
    cutOver(sourcePath, keyframePacket, session) {
        this.logger.log(`[Switch] performing cut-over to ${sourcePath}${this.forceSwitchNext ? ' (FORCED)' : ''}`);
        if (this.switchTimer) {
            clearTimeout(this.switchTimer);
            this.switchTimer = null;
        }
        this.timestampOffset = (this.lastOutputDts + 1) - keyframePacket.dts;
        this.sendSourceHeaders(sourcePath);
        // Clear GOP cache to ensure new subscribers get packets from the new source only
        this.flvGopCache?.clear();
        this.rtmpGopCache?.clear();
        if (this.activeSession && this.activeSession !== session) {
            this.activeSession.unsetAsPublisher();
        }
        this.activeSession = session;
        this.activeSession.setAsPublisher();
        this.activeSourcePath = sourcePath;
        this.pendingSourcePath = null;
        this.switching = false;
        this.state = nms_shared_1.BroadcastState.LIVE;
        this.logger.log(`[Switch] switched successfully to ${sourcePath}`);
        nms_core_1.context.nodeEvent.emit('postSwitch', this);
        // Forward the cut-over packet
        const adjustedPacket = this.adjustTimestamp(keyframePacket);
        this.lastOutputDts = adjustedPacket.dts;
        session.forwardPacket(adjustedPacket);
    }
    sendSourceHeaders(sourcePath) {
        const sourceBroadcast = nms_core_1.context.broadcasts.get(sourcePath);
        if (!sourceBroadcast) {
            return;
        }
        // Sync our internal headers with the source's headers
        this.flvMetaData = sourceBroadcast.getFlvMetaData;
        this.flvAudioHeader = sourceBroadcast.getFlvAudioHeader;
        this.flvVideoHeader = sourceBroadcast.getFlvVideoHeader;
        this.rtmpMetaData = sourceBroadcast.getRtmpMetaData;
        this.rtmpAudioHeader = sourceBroadcast.getRtmpAudioHeader;
        this.rtmpVideoHeader = sourceBroadcast.getRtmpVideoHeader;
        // Sync publisher metadata for the virtual session
        if (this.activeSession && sourceBroadcast.publisher) {
            const sp = sourceBroadcast.publisher;
            const vp = this.activeSession;
            vp.audioCodec = sp.audioCodec;
            vp.audioProfile = sp.audioProfile;
            vp.audioChannels = sp.audioChannels;
            vp.audioSamplerate = sp.audioSamplerate;
            vp.audioDatarate = sp.audioDatarate;
            vp.videoCodec = sp.videoCodec;
            vp.videoProfile = sp.videoProfile;
            vp.videoLevel = sp.videoLevel;
            vp.videoWidth = sp.videoWidth;
            vp.videoHeight = sp.videoHeight;
            vp.videoFramerate = sp.videoFramerate;
            vp.videoDatarate = sp.videoDatarate;
        }
        // Broadcast the new headers to all current subscribers
        this.subscribers.forEach((session) => {
            const avSession = session;
            if (!avSession.protocol) {
                return;
            }
            if (avSession.protocol === nms_server_1.Protocol.RTMP) {
                if (this.rtmpMetaData) {
                    avSession.sendBuffer(this.rtmpMetaData);
                }
                if (this.rtmpAudioHeader) {
                    avSession.sendBuffer(this.rtmpAudioHeader);
                }
                if (this.rtmpVideoHeader) {
                    avSession.sendBuffer(this.rtmpVideoHeader);
                }
            }
            else {
                if (this.flvMetaData) {
                    avSession.sendBuffer(this.flvMetaData);
                }
                if (this.flvAudioHeader) {
                    avSession.sendBuffer(this.flvAudioHeader);
                }
                if (this.flvVideoHeader) {
                    avSession.sendBuffer(this.flvVideoHeader);
                }
            }
        });
    }
}
exports.SwitchableBroadcastServer = SwitchableBroadcastServer;
