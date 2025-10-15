import { PathLike } from 'fs';
import { SessionConfig } from '../session.js';
import { AuthConfig } from './index.js';

export type RtmpSslConfig = {
    readonly port?: number;
    readonly key: PathLike;
    readonly cert: PathLike;
}

export type RtmpConfig = {
    readonly port?: number;
    readonly ssl?: RtmpSslConfig;
    readonly chunk_size?: number;
    readonly ping?: number;
    readonly ping_timeout?: number;
    readonly gop_cache?: boolean;
}

export type RtmpSessionConfig = SessionConfig<never> & {
    readonly auth?: AuthConfig;
    readonly rtmp: RtmpConfig;
}
