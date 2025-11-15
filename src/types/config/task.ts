export type TaskConfig = {
    readonly app: string;
}

export type SelectiveTaskConfig = TaskConfig & {
    readonly pattern?: string | RegExp;
}
