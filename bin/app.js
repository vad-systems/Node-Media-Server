#!/usr/bin/env node 

const { default: NodeMediaServer } = require("..");
const RelayMode = NodeMediaServer.types.RelayMode;
const LogType = NodeMediaServer.types.LogType;
let argv = require("minimist")(
    process.argv.slice(2),
    {
        string: ["rtmp_port", "http_port", "https_port"],
        alias: {
            "rtmp_port": "r",
            "http_port": "h",
            "https_port": "s",
        },
        default: {
            "rtmp_port": 1935,
            "http_port": 8000,
            "https_port": 8443,
        },
    },
);

if (argv.help) {
    console.log("Usage:");
    console.log("  node-media-server --help // print help information");
    console.log("  node-media-server --rtmp_port 1935 or -r 1935");
    console.log("  node-media-server --http_port 8000 or -h 8000");
    console.log("  node-media-server --https_port 8443 or -s 8443");
    process.exit(0);
}

/**
 *
 * @type RelayTaskConfig[]
 */
const relayTasks = [
    {
        app: "live-in",
        mode: RelayMode.PUSH,
        edge: "rtmp://127.0.0.1:1935/live",
    },
    {
        app: "live-in",
        mode: RelayMode.PUSH,
        pattern: "/test(1|2)$",
        edge: "rtmp://127.0.0.1:1935/relay-yt",
    },
    {
        app: "relay-yt",
        pattern: "/test1$",
        mode: RelayMode.PUSH,
        edge: "rtmp://127.0.0.1:1935/yt-out/test1_yt",
        appendName: false,
        rescale: "1920:1080",
    },
    {
        app: "relay-yt",
        pattern: "/test2$",
        mode: RelayMode.PUSH,
        edge: "rtmp://127.0.0.1:1935/yt-out/test2_yt",
        appendName: false,
        rescale: "1920:1080",
    },
];

/**
 *
 * @type FissionTaskConfig[]
 */
const fissionTasks = [
    {
        app: "live",
        pattern: "/live/.*",
        model: [
            {
                ab: "64k",
                vb: "2300k",
                vs: "1920x1080",
                vf: "30",
            },
            {
                ab: "64k",
                vb: "1800k",
                vs: "1280x720",
                vf: "30",
            },
            {
                ab: "48k",
                vb: "1200k",
                vs: "854x480",
                vf: "30",
            },
            {
                ab: "32k",
                vb: "900k",
                vs: "640x360",
                vf: "30",
            },
            {
                ab: "32k",
                vb: "700k",
                vs: "426x240",
                vf: "30",
            },
        ],
    },
];

/**
 *
 * @type Config
 */
const config = {
    logType: LogType.DEBUG,
    rtmp: {
        port: parseInt(argv.rtmp_port, 10),
        chunk_size: 60000,
        gop_cache: true,
        ping: 30,
        ping_timeout: 60,
        // ssl: {
        //   port: 443,
        //   key: __dirname+'/key.pem',
        //   cert: __dirname+'/cert.pem',
        // }
    },
    http: {
        port: parseInt(argv.http_port, 10),
        mediaroot: __dirname + "/media",
        webroot: __dirname + "/www",
        allow_origin: "*",
        api: true,
    },
    av: {},
    https: {
        port: parseInt(argv.https_port, 10),
        key: __dirname + "/key.pem",
        cert: __dirname + "/cert.pem",
    },
    relay: {
        ffmpeg: "/opt/homebrew/bin/ffmpeg",
        tasks: relayTasks,
    },
    fission: {
        ffmpeg: "/opt/homebrew/bin/ffmpeg",
        tasks: fissionTasks,
    },
    /*trans: {
        ffmpeg: "/opt/homebrew/bin/ffmpeg",
        tasks: [
            {
                app: "live",
                hls: true,
                hlsFlags: "[hls_time=2:hls_list_size=3:hls_flags=delete_segments]",
                dash: true,
                dashFlags: "[f=dash:window_size=3:extra_window_size=5]",
            },
        ],
    },*/
    switch: {
        tasks: [
            {
                app: "live",
                name: "test_complete",
                sources: ["/live-in/test01", "/live-in/test02"],
                switchTimeout: 10000,
            },
        ],
    },
    auth: {
        api: true,
        api_user: "admin",
        api_pass: "admin",
        play: false,
        publish: false,
        secret: "nodemedia2017privatekey",
    },
};


let nms = new NodeMediaServer(config);
nms.run();

nms.on("preConnect", (session) => {
    console.log("[NodeEvent on preConnect]", `id=${session.id} ip=${session.remoteIp} tag=${session.TAG}`);
});

nms.on("postConnect", (session) => {
    console.log("[NodeEvent on postConnect]", `id=${session.id} ip=${session.remoteIp} tag=${session.TAG}`);
});

nms.on("doneConnect", (session) => {
    console.log(
        "[NodeEvent on doneConnect]",
        `id=${session.id} ip=${session.remoteIp} tag=${session.TAG} inBytes=${session.inBytes} outBytes=${session.outBytes}`,
    );
});

nms.on("prePublish", (session) => {
    console.log(
        "[NodeEvent on prePublish]",
        `id=${session.id} StreamPath=${session.streamPath} args=${JSON.stringify(session.streamQuery)}`,
    );
});

nms.on("postPublish", (session) => {
    console.log(
        "[NodeEvent on postPublish]",
        `id=${session.id} StreamPath=${session.streamPath} args=${JSON.stringify(session.streamQuery)}`,
    );
});

nms.on("donePublish", (session) => {
    console.log(
        "[NodeEvent on donePublish]",
        `id=${session.id} StreamPath=${session.streamPath} args=${JSON.stringify(session.streamQuery)}`,
    );
});

nms.on("prePlay", (session) => {
    console.log(
        "[NodeEvent on prePlay]",
        `id=${session.id} StreamPath=${session.streamPath} args=${JSON.stringify(session.streamQuery)}`,
    );
});

nms.on("postPlay", (session) => {
    console.log(
        "[NodeEvent on postPlay]",
        `id=${session.id} StreamPath=${session.streamPath} args=${JSON.stringify(session.streamQuery)}`,
    );
});

nms.on("donePlay", (session) => {
    console.log(
        "[NodeEvent on donePlay]",
        `id=${session.id} StreamPath=${session.streamPath} args=${JSON.stringify(session.streamQuery)}`,
    );
});
