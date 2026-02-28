# Node-Media-Server

A high-performance Node.js implementation of a Media Server, supporting RTMP, HTTP-FLV, and WebSocket-FLV.

## Features

- **RTMP Server**: High-performance RTMP streaming.
- **HTTP-FLV / WebSocket-FLV**: Play streams in browsers via FLV over HTTP or WebSockets (requires `av` plugin).
- **Transcoding (Fission)**: Dynamic multi-bitrate transcoding using FFmpeg.
- **Relay**: Push streams to other RTMP servers or other apps on this server.
- **Transmuxing (Trans)**: Support for HLS and DASH.
- **REST API**: Manage and monitor your server via HTTP.
- **Admin Dashboard**: Built-in web interface available at `/admin` (viewing streams requires `av` plugin).

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (version 22 or higher)
- [FFmpeg](https://ffmpeg.org/) (required for Fission, Relay, and Trans plugins)

### Installation

```bash
npm install https://github.com/vad-systems/Node-Media-Server.git
```

See [Configuration](#Configuration) for configuration and startup.

#### Development

```bash
git clone https://github.com/vad-systems/Node-Media-Server.git
cd Node-Media-Server
npm install
```

### Running the server

```bash
npm start
```

By default, the server will listen on:
- RTMP: `1935`
- HTTP: `8000`
- HTTPS: `8443`

## Usage

### Streaming to the server (RTMP)

You can use OBS or FFmpeg to push a stream:

```bash
ffmpeg -re -i input.mp4 -c copy -f flv rtmp://localhost/live/test
```

### Playing the stream

- **RTMP**: `rtmp://localhost/live/test`
- **HTTP-FLV**: `http://localhost:8000/live/test.flv`
- **WebSocket-FLV**: `ws://localhost:8000/live/test.flv`

## Configuration

The server is configured using a configuration object. Below is a basic example:

```javascript
const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    mediaroot: './media',
    allow_origin: '*',
    api: true
  },
  av: {}, // Enable HTTP-FLV/WS-FLV plugin
  auth: {
    api: true,
    api_user: 'admin',
    api_pass: 'admin',
    secret: 'your_secret_key'
  }
};

const nms = new NodeMediaServer(config);
nms.run();
```

## Plugins

Node-Media-Server features a plugin-based architecture for extended functionality:

- **Av Plugin**: Provides HTTP-FLV and WebSocket-FLV playback capabilities.
- **Fission Plugin**: Enables dynamic transcoding using FFmpeg. Define multiple output models (resolution, bitrate, etc.) for a single input stream.
- **Relay Plugin**: Relays streams to other RTMP servers based on patterns.
- **Trans Plugin**: Transmuxes streams to HLS and DASH formats.

## REST API

The server provides a comprehensive REST API for management. You can find the full OpenAPI specification in [openapi.yaml](./openapi.yaml).

Key endpoints include:

- `GET /api/server/info`: General server statistics and system information.
- `GET /api/server/status`: Status of running server components.
- `GET /api/streams`: List of active publishers and subscribers.
- `DELETE /api/streams/:app/:name`: Terminate a specific stream.

## License

MIT
