export type SwitchTaskConfig = {
    readonly app: string;
    readonly name: string;
    readonly sources: string[];
    readonly defaultSource?: string;
    readonly switchTimeout?: number;
    readonly slatePath?: string;
}

export type SwitchConfig = {
    readonly tasks: SwitchTaskConfig[];
}
