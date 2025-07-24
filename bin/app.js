#!/usr/bin/env node 

const NodeMediaServer = require('..');
let argv = require('minimist')(process.argv.slice(2),
    {
        string: ['rtmp_port', 'http_port', 'https_port'],
        alias: {
            'rtmp_port': 'r',
            'http_port': 'h',
            'https_port': 's',
        },
        default: {
            'rtmp_port': 1935,
            'http_port': 8000,
            'https_port': 8443,
        }
    });

if (argv.help) {
    console.log('Usage:');
    console.log('  node-media-server --help // print help information');
    console.log('  node-media-server --rtmp_port 1935 or -r 1935');
    console.log('  node-media-server --http_port 8000 or -h 8000');
    console.log('  node-media-server --https_port 8443 or -s 8443');
    process.exit(0);
}

/**
 *
 * @type RelayTaskConfig[]
 */
const relayTasks = [
    {
        app: 'live-in',
        mode: NodeMediaServer.types.Mode.PUSH,
        edge: 'rtmp://127.0.0.1:1935/live',
    },
    {
        app: 'live-in',
        mode: NodeMediaServer.types.Mode.PUSH,
        pattern: '/test(1|2)$',
        edge: 'rtmp://127.0.0.1:1935/relay-yt',
    },
    {
        app: 'relay-yt',
        mode: NodeMediaServer.types.Mode.PUSH,
        edge: {
            'test1': 'rtmp://127.0.0.1:1935/yt-out/test1_yt',
            'test2': 'rtmp://127.0.0.1:1935/yt-out/test2_yt',
        },
        appendName: false,
        rescale: '1920:1080',
    },
];

/**
 *
 * @type FissionTaskConfig[]
 */
const fissionTasks = [
    {
        rule: "live/*",
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
    logType: NodeMediaServer.types.LogType.DEBUG,
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
        mediaroot: __dirname + '/media',
        webroot: __dirname + '/www',
        allow_origin: '*',
        api: true
    },
    https: {
        port: parseInt(argv.https_port, 10),
        key: __dirname + '/key.pem',
        cert: __dirname + '/cert.pem',
    },
    relay: {
        ffmpeg: 'C:\\Users\\fejpe\\ffmpeg\\bin\\ffmpeg.exe',
        tasks: relayTasks,
    },
    fission: {
        ffmpeg: 'C:\\Users\\fejpe\\ffmpeg\\bin\\ffmpeg.exe',
        tasks: fissionTasks,
    },
    auth: {
        api: true,
        api_user: 'admin',
        api_pass: 'admin',
        play: false,
        publish: false,
        secret: 'nodemedia2017privatekey'
    }
};


let nms = new NodeMediaServer(config);
nms.run();

nms.on('preConnect', (id, args) => {
    console.log('[NodeEvent on preConnect]', `id=${id} args=${JSON.stringify(args)}`);
    // let session = nms.getSession(id);
    // session.reject();
});

nms.on('postConnect', (id, args) => {
    console.log('[NodeEvent on postConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('doneConnect', (id, args) => {
    console.log('[NodeEvent on doneConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('prePublish', (id, StreamPath, args) => {
    console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
    // let session = nms.getSession(id);
    // session.reject();
});

nms.on('postPublish', (id, StreamPath, args) => {
    console.log('[NodeEvent on postPublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePublish', (id, StreamPath, args) => {
    console.log('[NodeEvent on donePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('prePlay', (id, StreamPath, args) => {
    console.log('[NodeEvent on prePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
    // let session = nms.getSession(id);
    // session.reject();
});

nms.on('postPlay', (id, StreamPath, args) => {
    console.log('[NodeEvent on postPlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePlay', (id, StreamPath, args) => {
    console.log('[NodeEvent on donePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

