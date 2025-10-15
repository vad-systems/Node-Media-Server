import { PathLike } from 'fs';
import { FfmpegSessionConfig } from '../session.js';
import { TaskConfig } from './task.js';

export type TransTaskConfig = TaskConfig & {
    readonly rtmp?: boolean;
    readonly rtmpApp?: string;
    readonly mp4?: boolean;
    readonly mp4Flags?: string;
    readonly hls?: boolean;
    readonly hlsFlags?: string;
    readonly hlsKeep?: boolean;
    readonly dash?: boolean;
    readonly dashFlags?: string;
    readonly dashKeep?: boolean;

    readonly vc?: string;
    readonly vcParam?: string[];
    readonly ac?: string;
    readonly acParam?: string[];
}

export type TransConfig = {
    readonly ffmpeg: string;
    readonly tasks: TransTaskConfig[];
}

export type TransSessionConfig = TransTaskConfig & FfmpegSessionConfig<object> & {
    readonly mediaroot: PathLike;
    readonly rtmpPort: number;
    readonly streamPath: string;
    readonly streamApp: string;
    readonly streamName: string;
}
