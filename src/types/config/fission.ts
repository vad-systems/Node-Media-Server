import { PathLike } from 'fs';
import { FfmpegSessionConfig } from '../session.js';
import { TaskConfig } from './task.js';

export type FissionModelConfig = {
    readonly vb: string;
    readonly vf: string;
    readonly vs: string;
    readonly ab: string;
}

export type FissionTaskConfig = TaskConfig & {
    readonly model: FissionModelConfig[];
}

export type FissionConfig = {
    readonly ffmpeg: string;
    readonly tasks: FissionTaskConfig[];
}

export type FissionSessionConfig = FissionTaskConfig & FfmpegSessionConfig<object> & {
    readonly mediaroot: PathLike;
    readonly rtmpPort: number;
    readonly streamPath: string;
    readonly streamApp: string;
    readonly streamName: string;
}
