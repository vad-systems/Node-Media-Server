import { FlvAudioCodec, FlvVideoCodec } from '@vad-systems/nms-protocol';
import { BaseAvSession } from '@vad-systems/nms-server';
import { Context } from '@vad-systems/nms-shared';
import { NextFunction, Request, Response } from 'express';
import _ from 'lodash';

function getStreams(this: Context, req: Request, res: Response, next: NextFunction) {
    let stats: any = {};

    this.broadcasts.forEach((broadcast, key) => {
        const [k, app, name] = key.split('/');
        const publisher = broadcast.publisher as BaseAvSession<any, any>;
        _.setWith(stats, [app, name], {
            key,
            app,
            name,
            publisher: publisher ? {
                app,
                stream: name,
                clientId: publisher.id,
                ip: publisher.remoteIp,
                protocol: publisher.protocol === 'websocket-flv' ? 'ws' : (
                    publisher.protocol === 'http-flv' ? 'http' : publisher.protocol
                ),
                connectCreated: publisher.startTime,
                video: publisher.videoCodec !== null ? {
                    codec: FlvVideoCodec[publisher.videoCodec],
                    width: publisher.videoWidth,
                    height: publisher.videoHeight,
                    profile: publisher.videoProfile,
                    level: publisher.videoLevel,
                    fps: publisher.videoFramerate,
                } : null,
                audio: publisher.audioCodec !== null ? {
                    codec: FlvAudioCodec[publisher.audioCodec],
                    profile: publisher.audioProfile,
                    channels: publisher.audioChannels,
                    samplerate: publisher.audioSamplerate,
                } : null,
                bytes: publisher.inBytes,
            } : null,
            subscribers: [...broadcast.subscribers.values()].map(
                subscriber => {
                    switch (subscriber.TAG) {
                        case 'rtmp': {
                            return {
                                app,
                                stream: name,
                                clientId: subscriber.id,
                                connectCreated: subscriber.startTime,
                                bytes: subscriber.outBytes,
                                ip: subscriber.remoteIp,
                                protocol: 'rtmp',
                            };
                        }
                        case 'http-flv':
                        case 'websocket-flv': {
                            return {
                                app,
                                stream: name,
                                clientId: subscriber.id,
                                connectCreated: subscriber.startTime,
                                bytes: subscriber.outBytes,
                                ip: subscriber.remoteIp,
                                protocol: subscriber.TAG === 'websocket-flv' ? 'ws' : 'http',
                            };
                        }
                        case 'relay':
                        case 'trans':
                        case 'fission': {
                            return {
                                app,
                                stream: name,
                                clientId: subscriber.id,
                                connectCreated: subscriber.startTime,
                                bytes: subscriber.outBytes,
                                ip: subscriber.remoteIp,
                                protocol: subscriber.TAG,
                            };
                        }
                    }
                    return null;
                },
            ).filter(Boolean),
        });
    });

    res.json(stats);
}

function getStream(this: Context, req: Request, res: Response, next: NextFunction) {
    let streamStats: any = {
        isLive: false,
        viewers: 0,
        duration: 0,
        bitrate: 0,
        startTime: null,
        arguments: {},
    };

    let publishStreamPath = `/${req.params.app}/${req.params.stream}`;
    let broadcast = this.broadcasts.get(publishStreamPath);

    let publisherSession: BaseAvSession<any, any> = broadcast?.publisher;

    streamStats.isLive = publisherSession && !publisherSession.isStop;
    streamStats.viewers = broadcast?.subscribers?.size || 0;
    streamStats.duration = streamStats.isLive
        ? Math.ceil((
            Date.now() - publisherSession.startTime
        ) / 1000)
        : 0;
    streamStats.bitrate = (publisherSession?.videoDatarate || 0) + (publisherSession?.audioDatarate || 0);
    streamStats.startTime = streamStats.isLive
        ? publisherSession.startTime
        : null;
    streamStats.arguments = publisherSession?.streamQuery || {};

    res.json(streamStats);
}

function delStream(this: Context, req: Request, res: Response, next: NextFunction) {
    let publishStreamPath = `/${req.params.app}/${req.params.stream}`;
    let publisherSession = this.sessions.get(
        this.broadcasts.get(publishStreamPath)?.publisher?.id,
    );

    if (publisherSession) {
        publisherSession.stop();
        res.json('ok');
    } else {
        res.status(404).json({ error: 'stream not found' });
    }
}

function getStreamsTree(this: Context, req: Request, res: Response, next: NextFunction) {
    const sessionsMap = new Map<string, any>();
    const sessionNodes = new Map<string, any>();

    // 1. Create all session nodes
    this.sessions.forEach((session) => {
        const node = {
            id: session.id,
            type: session.TAG,
            status: session.isStop ? 'stopped' : 'running',
            children: [] as any[],
        };
        sessionNodes.set(session.id, node);
        sessionsMap.set(session.id, session);
    });

    // 2. Establish parent-child relationships
    const childrenIds = new Set<string>();
    this.sessions.forEach((session) => {
        if (session.parentId && sessionNodes.has(session.parentId)) {
            const parentNode = sessionNodes.get(session.parentId);
            const childNode = sessionNodes.get(session.id);
            if (!parentNode.children.includes(childNode)) {
                parentNode.children.push(childNode);
            }
            childrenIds.add(session.id);
        }
    });

    // 3. Build broadcast tree
    const broadcasts: any[] = [];
    this.broadcasts.forEach((broadcast, streamPath) => {
        const bNode: any = {
            streamPath,
            publisher: null,
            subscribers: [] as any[],
        };

        if (broadcast.publisher) {
            bNode.publisher = sessionNodes.get(broadcast.publisher.id);
        }

        broadcast.subscribers.forEach((subscriber) => {
            bNode.subscribers.push(sessionNodes.get(subscriber.id));
        });

        broadcasts.push(bNode);
    });

    // 4. Identify orphaned sessions
    // Orphaned = No parent AND not a publisher or subscriber in any broadcast
    const sessionsInBroadcasts = new Set<string>();
    this.broadcasts.forEach((broadcast) => {
        if (broadcast.publisher) sessionsInBroadcasts.add(broadcast.publisher.id);
        broadcast.subscribers.forEach((s) => sessionsInBroadcasts.add(s.id));
    });

    const orphans = Array.from(sessionNodes.values()).filter(
        (node) => !childrenIds.has(node.id) && !sessionsInBroadcasts.has(node.id)
    );

    res.json({
        broadcasts,
        orphans,
    });
}

export default {
    delStream,
    getStreams,
    getStream,
    getStreamsTree,
};
