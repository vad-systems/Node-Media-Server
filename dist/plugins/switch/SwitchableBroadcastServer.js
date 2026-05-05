"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwitchableBroadcastServer = void 0;
const nms_core_1 = require("../../core");
const nms_protocol_1 = require("../../protocol");
const nms_server_1 = require("../../server");
class SwitchableBroadcastServer extends nms_server_1.AvBroadcastServer {
    activeSourcePath = null;
    pendingSourcePath = null;
    timestampOffset = 0;
    lastOutputDts = 0;
    switching = false;
    switchTimer = null;
    forceSwitchNext = false;
    manualSwitch = false;
    virtualPublisher = null;
    constructor() {
        super();
    }
    get activeSource() {
        return this.activeSourcePath;
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
        // Check if initial source is already active
        const sourceBroadcast = nms_core_1.context.broadcasts.get(sourcePath);
        if (sourceBroadcast && sourceBroadcast.publisher && !sourceBroadcast.publisher.isStop) {
            if (this.virtualPublisher) {
                this.virtualPublisher.isStop = false;
                this.publisher = this.virtualPublisher;
            }
        }
        else {
            this.publisher = null;
        }
        // Optionally pre-load headers from initial source if it's already publishing
        this.sendSourceHeaders(sourcePath);
    }
    setVirtualPublisher(session) {
        this.virtualPublisher = session;
    }
    handleSourcePacket(sourcePath, packet) {
        if (this.switching && sourcePath === this.pendingSourcePath) {
            // Check for video keyframe to perform cut-over or if we are forcing it
            if (packet.flags === 3 || this.forceSwitchNext) {
                this.cutOver(sourcePath, packet);
            }
        }
        if (sourcePath !== this.activeSourcePath) {
            return;
        }
        const adjustedPacket = this.adjustTimestamp(packet);
        // Track last output DTS to calculate offset later
        this.lastOutputDts = adjustedPacket.dts;
        this.broadcastMessage(adjustedPacket);
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
    switchSource(newSourcePath, timeout = 0, isManual = true) {
        if (newSourcePath === this.activeSourcePath) {
            this.cancelSwitch();
            this.manualSwitch = isManual;
            return;
        }
        this.cancelSwitch();
        if (newSourcePath === null) {
            this.activeSourcePath = null;
            this.manualSwitch = false;
            this.logger.log(`Broadcast source cleared`);
            return;
        }
        this.pendingSourcePath = newSourcePath;
        this.switching = true;
        this.forceSwitchNext = false;
        this.manualSwitch = isManual;
        this.logger.log(`Switching pending: ${this.activeSourcePath} -> ${newSourcePath}`);
        if (timeout > 0) {
            this.switchTimer = setTimeout(() => {
                this.logger.warn(`Switch timeout reached for ${newSourcePath}, forcing switch on next packet`);
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
    }
    cutOver(sourcePath, keyframePacket) {
        this.logger.log(`Performing cut-over to ${sourcePath}${this.forceSwitchNext ? ' (FORCED)' : ''}`);
        if (this.switchTimer) {
            clearTimeout(this.switchTimer);
            this.switchTimer = null;
        }
        this.timestampOffset = (this.lastOutputDts + 1) - keyframePacket.dts;
        this.sendSourceHeaders(sourcePath);
        // Clear GOP cache to ensure new subscribers get packets from the new source only
        this.flvGopCache?.clear();
        this.rtmpGopCache?.clear();
        this.activeSourcePath = sourcePath;
        if (this.virtualPublisher) {
            this.virtualPublisher.isStop = false;
            this.publisher = this.virtualPublisher;
        }
        this.pendingSourcePath = null;
        this.switching = false;
    }
    sendSourceHeaders(sourcePath) {
        const sourceBroadcast = nms_core_1.context.broadcasts.get(sourcePath);
        if (!sourceBroadcast) {
            return;
        }
        // Sync our internal headers with the source's headers
        this.flvMetaData = sourceBroadcast['flvMetaData'];
        this.flvAudioHeader = sourceBroadcast['flvAudioHeader'];
        this.flvVideoHeader = sourceBroadcast['flvVideoHeader'];
        this.rtmpMetaData = sourceBroadcast['rtmpMetaData'];
        this.rtmpAudioHeader = sourceBroadcast['rtmpAudioHeader'];
        this.rtmpVideoHeader = sourceBroadcast['rtmpVideoHeader'];
        // Sync publisher metadata for the virtual session
        if (this.publisher && sourceBroadcast.publisher) {
            const sp = sourceBroadcast.publisher;
            const vp = this.publisher;
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
            if (!(session instanceof nms_server_1.BaseAvSession)) {
                return;
            }
            if (session.protocol === nms_server_1.Protocol.RTMP) {
                if (this.rtmpMetaData) {
                    session.sendBuffer(this.rtmpMetaData);
                }
                if (this.rtmpAudioHeader) {
                    session.sendBuffer(this.rtmpAudioHeader);
                }
                if (this.rtmpVideoHeader) {
                    session.sendBuffer(this.rtmpVideoHeader);
                }
            }
            else {
                if (this.flvMetaData) {
                    session.sendBuffer(this.flvMetaData);
                }
                if (this.flvAudioHeader) {
                    session.sendBuffer(this.flvAudioHeader);
                }
                if (this.flvVideoHeader) {
                    session.sendBuffer(this.flvVideoHeader);
                }
            }
        });
    }
}
exports.SwitchableBroadcastServer = SwitchableBroadcastServer;
