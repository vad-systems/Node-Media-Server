import { Arguments } from '.';

export type SessionConfig<A extends Arguments> = {
    args?: A;
}

export type FfmpegSessionConfig<A> = SessionConfig<A> & {
    readonly ffmpeg: string;
}
