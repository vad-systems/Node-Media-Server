import { FlvAudioCodec, FlvVideoCodec } from '@vad-systems/nms-protocol';
import { BaseAvSession } from '@vad-systems/nms-server';
import { Context, SessionState } from '@vad-systems/nms-shared';
import { NextFunction, Request, Response } from 'express';
import _ from 'lodash';
import { isSSERequest, streamStats } from './sse.js';

function getStreams(this: Context, req: Request, res: Response, next: NextFunction) {
    const fetchStats = () => {
        let stats: any = {};

        this.broadcasts.forEach((broadcast, key) => {
            const [k, app, name] = key.split('/');
            const publisher = broadcast.publisher as BaseAvSession<any, any>;
            _.setWith(stats, [app, name], {
                key,
                id: broadcast.id,
                app,
                name,
                state: broadcast.state,
                publisher: publisher ? {
                    app,
                    stream: name,
                    clientId: publisher.id,
                    ip: publisher.remoteIp,
                    state: publisher.state,
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
                                    state: subscriber.state,
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
                                    state: subscriber.state,
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
                                    state: subscriber.state,
                                    protocol: subscriber.TAG,
                                };
                            }
                        }
                        return null;
                    },
                ).filter(Boolean),
            });
        });
        return stats;
    };

    if (isSSERequest(req)) {
        streamStats(req, res, fetchStats, 2000);
        return;
    }

    res.json(fetchStats());
}

function getStream(this: Context, req: Request, res: Response, next: NextFunction) {
    let streamStats: any = {
        viewers: 0,
        duration: 0,
        bitrate: 0,
        startTime: null,
        state: null,
        arguments: {},
    };

    let publishStreamPath = `/${req.params.app}/${req.params.stream}`;
    let broadcast = this.broadcasts.get(publishStreamPath);

    let publisherSession: BaseAvSession<any, any> = broadcast?.publisher;

    const isLive = publisherSession && (publisherSession.state === SessionState.RUNNING);
    streamStats.broadcastId = broadcast?.id || null;
    streamStats.publisherId = publisherSession?.id || null;
    streamStats.viewers = broadcast?.subscribers?.size || 0;
    streamStats.state = broadcast?.state || null;
    streamStats.duration = isLive
        ? Math.ceil((
            Date.now() - publisherSession.startTime
        ) / 1000)
        : 0;
    streamStats.bitrate = (publisherSession?.videoDatarate || 0) + (publisherSession?.audioDatarate || 0);
    streamStats.startTime = isLive
        ? publisherSession.startTime
        : null;
    streamStats.publisherState = publisherSession?.state || null;
    streamStats.arguments = publisherSession?.streamQuery || {};

    res.json(streamStats);
}

function delStream(this: Context, req: Request, res: Response, next: NextFunction) {
    let publishStreamPath = `/${req.params.app}/${req.params.stream}`;
    let publisherSession = this.sessions.get(
        this.broadcasts.get(publishStreamPath)?.publisher?.id,
    );

    if (publisherSession) {
        publisherSession.stop(true);
        res.json({ status: 'ok' });
    } else {
        res.status(404).json({ error: 'stream not found' });
    }
}

function getStreamsTree(this: Context, req: Request, res: Response, next: NextFunction) {
    const fetchTree = () => {
        const sessionsMap = new Map<string, any>();
        const sessionNodes = new Map<string, any>();

        // 1. Create all session nodes
        this.sessions.forEach((session) => {
            const node = {
                id: session.id,
                type: session.TAG,
                state: session.state,
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
                id: broadcast.id,
                streamPath,
                state: broadcast.state,
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

        return {
            broadcasts,
            orphans,
        };
    };

    if (isSSERequest(req)) {
        streamStats(req, res, fetchTree, 2000);
        return;
    }

    res.json(fetchTree());
}

function startSession(this: Context, req: Request, res: Response, next: NextFunction) {
    const session = this.sessions.get(req.params.id as string);
    if (session) {
        let args = req.body;
        if (session.isFfmpegTask()) {
            if (!Array.isArray(args)) {
                if (typeof args === 'object' && args !== null && Array.isArray(args.args)) {
                    args = args.args;
                } else {
                    args = [];
                }
            }
        }
        session.start(args);
        res.json({ status: 'ok' });
    } else {
        res.status(404).json({ error: 'session not found' });
    }
}

function stopSession(this: Context, req: Request, res: Response, next: NextFunction) {
    const session = this.sessions.get(req.params.id as string);
    if (session) {
        session.stop(true);
        res.json({ status: 'ok' });
    } else {
        res.status(404).json({ error: 'session not found' });
    }
}

function restartSession(this: Context, req: Request, res: Response, next: NextFunction) {
    const session = this.sessions.get(req.params.id as string);
    if (session) {
        session.restart();
        res.json({ status: 'ok' });
    } else {
        res.status(404).json({ error: 'session not found' });
    }
}

function stopBroadcast(this: Context, req: Request, res: Response, next: NextFunction) {
    let publishStreamPath = `/${req.params.app}/${req.params.stream}`;
    let broadcast = this.broadcasts.get(publishStreamPath);
    if (broadcast) {
        broadcast.stop();
        res.json({ status: 'ok' });
    } else {
        res.status(404).json({ error: 'broadcast not found' });
    }
}

export default {
    delStream,
    getStreams,
    getStream,
    getStreamsTree,
    startSession,
    stopSession,
    restartSession,
    stopBroadcast,
};
