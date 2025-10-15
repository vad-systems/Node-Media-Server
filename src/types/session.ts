import { Arguments } from './index.js';

export type SessionConfig<A extends Arguments> = {
    args?: A;
}

export type FfmpegSessionConfig<A> = SessionConfig<A> & {
    readonly ffmpeg: string;
}
