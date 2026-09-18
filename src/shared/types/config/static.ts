import { FfmpegSessionConfig } from '../session.js';
import { TaskConfig } from './task.js';

export type StaticTaskConfig = TaskConfig & {
    readonly name: string;
    readonly input: string;
    readonly textPath?: string;
    readonly vc?: string;
    readonly vcParam?: string[];
    readonly ac?: string;
    readonly acParam?: string[];
}

export type StaticConfig = {
    readonly ffmpeg: string;
    readonly tasks: StaticTaskConfig[];
}

export type StaticSessionConfig = StaticTaskConfig & FfmpegSessionConfig<never> & {
    readonly streamPath: string;
    readonly rtmpPort?: number;
}
