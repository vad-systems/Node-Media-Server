export type SessionID = string;

export type Arguments = {
    [key: string]: any
}

export type NodeEventMap = {
    preConnect: [SessionID, any],
    postConnect: [SessionID, any],
    prePlay: [SessionID, string, Arguments],
    postPlay: [SessionID, string, Arguments],
    donePlay: [SessionID, string, Arguments],
    doneConnect: [SessionID, any],
    prePublish: [SessionID, string, Arguments],
    postPublish: [SessionID, string, Arguments],
    donePublish: [SessionID, string, Arguments],
    logMessage: any[],
    errorMessage: any[],
    debugMessage: any[],
    ffDebugMessage: any[],
};

export enum LogType {
    NONE = 0,
    ERROR = 1,
    NORMAL = 2,
    DEBUG = 3,
    FFDEBUG = 4,
}
