#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/nms-stale-publisher.XXXXXX")"

NMS_PID=""
PROXY_PID=""
PUB_A_PID=""
PUB_B_PID=""

NMS_LOG=""
PROXY_LOG=""
RTMP_PORT=""
PROXY_PORT=""
HTTP_PORT=""

fail() {
    echo "ERROR: $*" >&2
    exit 1
}

stop_pid() {
    local pid="${1:-}"

    if [[ -z "$pid" ]]; then
        return
    fi

    if kill -0 "$pid" 2>/dev/null; then
        kill -TERM "$pid" 2>/dev/null || true

        for ((i=0; i<20; i++)); do
            if ! kill -0 "$pid" 2>/dev/null; then
                break
            fi
            sleep 0.1
        done

        if kill -0 "$pid" 2>/dev/null; then
            kill -KILL "$pid" 2>/dev/null || true
        fi
    fi

    wait "$pid" 2>/dev/null || true
}

cleanup_case() {
    stop_pid "$PUB_B_PID"
    stop_pid "$PUB_A_PID"
    stop_pid "$PROXY_PID"
    stop_pid "$NMS_PID"

    PUB_B_PID=""
    PUB_A_PID=""
    PROXY_PID=""
    NMS_PID=""
}

on_exit() {
    local rc=$?

    cleanup_case

    if [[ "$rc" -eq 0 && "${KEEP_TEST_ARTIFACTS:-0}" != "1" ]]; then
        rm -rf "$WORKDIR"
    else
        echo "TEST_ARTIFACTS=$WORKDIR"
    fi

    if [[ "$rc" -ne 0 ]]; then
        echo "TEST_RESULT=FAIL"
    fi
}

trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for command in node ffmpeg python3 timeout grep; do
    command -v "$command" >/dev/null 2>&1 ||
        fail "required command not found: $command"
done

[[ -f "$REPO_ROOT/dist/NodeMediaServer.js" ]] ||
    fail "dist/NodeMediaServer.js missing; run npm run build first"

HARNESS="$WORKDIR/nms-harness.cjs"
PROXY_SCRIPT="$WORKDIR/rtmp-trickle-proxy.py"

cat >"$HARNESS" <<'NODE'
const { default: NodeMediaServer } = require(process.env.NMS_ENTRY);

const rtmp = {
    port: Number(process.env.RTMP_PORT),
    chunk_size: 60000,
    gop_cache: true,
    ping: 1,
    ping_timeout: 2,
};

if (process.env.STALE_TIMEOUT !== undefined &&
    process.env.STALE_TIMEOUT !== '') {
    rtmp.publisher_stale_timeout = Number(process.env.STALE_TIMEOUT);
}

const config = {
    logType: 4,
    rtmp,
    http: {
        port: Number(process.env.HTTP_PORT),
        allow_origin: '*',
        mediaroot: process.env.MEDIA_ROOT,
    },
    av: {},
};

const nms = new NodeMediaServer(config);
nms.run();
NODE

cat >"$PROXY_SCRIPT" <<'PY'
#!/usr/bin/env python3

import os
import socket
import threading
import time

LISTEN_HOST = "127.0.0.1"
LISTEN_PORT = int(os.environ["LISTEN_PORT"])
UPSTREAM_HOST = "127.0.0.1"
UPSTREAM_PORT = int(os.environ["UPSTREAM_PORT"])

WARMUP = float(os.environ.get("WARMUP", "2"))
TRICKLE_BYTES = int(os.environ.get("TRICKLE_BYTES", "1"))
TRICKLE_INTERVAL = float(os.environ.get("TRICKLE_INTERVAL", "0.5"))


def log(message):
    print(
        f"{time.strftime('%Y-%m-%d %H:%M:%S')} {message}",
        flush=True,
    )


def server_to_client(src, dst):
    try:
        while True:
            data = src.recv(65536)
            if not data:
                break
            dst.sendall(data)
    except Exception as exc:
        log(f"server->client ended: {exc}")
    finally:
        try:
            dst.shutdown(socket.SHUT_WR)
        except Exception:
            pass


listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
listener.bind((LISTEN_HOST, LISTEN_PORT))
listener.listen(1)

log(f"listening {LISTEN_HOST}:{LISTEN_PORT}")

client, address = listener.accept()
log(f"client connected {address}")

upstream = socket.create_connection((UPSTREAM_HOST, UPSTREAM_PORT))
log(f"upstream connected {UPSTREAM_HOST}:{UPSTREAM_PORT}")

threading.Thread(
    target=server_to_client,
    args=(upstream, client),
    daemon=True,
).start()

started = time.monotonic()
trickle_announced = False

try:
    while True:
        elapsed = time.monotonic() - started

        if elapsed < WARMUP:
            data = client.recv(65536)
            if not data:
                break
            upstream.sendall(data)
            continue

        if not trickle_announced:
            log(
                f"trickle mode active: "
                f"{TRICKLE_BYTES} byte(s) every {TRICKLE_INTERVAL}s"
            )
            trickle_announced = True

        data = client.recv(TRICKLE_BYTES)
        if not data:
            break

        upstream.sendall(data)
        log(f"trickle sent {len(data)} byte(s)")
        time.sleep(TRICKLE_INTERVAL)

except Exception as exc:
    log(f"client->server ended: {exc}")

finally:
    log("proxy closing")

    for sock in (client, upstream, listener):
        try:
            sock.close()
        except Exception:
            pass
PY

allocate_ports() {
    read -r RTMP_PORT PROXY_PORT HTTP_PORT < <(
        python3 <<'PY'
import socket

sockets = []
ports = []

for _ in range(3):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))
    sockets.append(sock)
    ports.append(sock.getsockname()[1])

print(*ports)

for sock in sockets:
    sock.close()
PY
    )
}

wait_for_port() {
    local port="$1"
    local attempts="${2:-50}"

    for ((i=0; i<attempts; i++)); do
        if python3 - "$port" <<'PY' >/dev/null 2>&1
import socket
import sys

port = int(sys.argv[1])

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.settimeout(0.2)

try:
    sock.connect(("127.0.0.1", port))
except OSError:
    sys.exit(1)
finally:
    sock.close()
PY
        then
            return 0
        fi

        sleep 0.1
    done

    return 1
}

wait_for_log() {
    local file="$1"
    local pattern="$2"
    local attempts="${3:-50}"

    for ((i=0; i<attempts; i++)); do
        if [[ -f "$file" ]] && grep -Fq -- "$pattern" "$file"; then
            return 0
        fi
        sleep 0.1
    done

    echo "Missing log pattern: $pattern" >&2
    [[ -f "$file" ]] && tail -100 "$file" >&2 || true
    return 1
}

wait_for_count() {
    local file="$1"
    local pattern="$2"
    local expected="$3"
    local attempts="${4:-50}"
    local count

    for ((i=0; i<attempts; i++)); do
        count="$(grep -Fc -- "$pattern" "$file" 2>/dev/null || true)"
        if (( count >= expected )); then
            return 0
        fi
        sleep 0.1
    done

    count="$(grep -Fc -- "$pattern" "$file" 2>/dev/null || true)"
    echo \
        "Pattern count too small: pattern='$pattern' expected=$expected actual=$count" \
        >&2
    tail -100 "$file" >&2 || true
    return 1
}

assert_no_log() {
    local file="$1"
    local pattern="$2"

    if grep -Fq -- "$pattern" "$file" 2>/dev/null; then
        echo "Unexpected log pattern: $pattern" >&2
        tail -100 "$file" >&2 || true
        return 1
    fi
}

assert_alive() {
    local pid="$1"
    local description="$2"

    kill -0 "$pid" 2>/dev/null ||
        fail "$description is no longer running (pid=$pid)"
}

start_nms() {
    local case_dir="$1"
    local stale_timeout="$2"

    allocate_ports

    mkdir -p "$case_dir/media"

    NMS_LOG="$case_dir/nms.log"

    NMS_ENTRY="$REPO_ROOT/dist/NodeMediaServer.js" \
    RTMP_PORT="$RTMP_PORT" \
    HTTP_PORT="$HTTP_PORT" \
    MEDIA_ROOT="$case_dir/media" \
    STALE_TIMEOUT="$stale_timeout" \
        node "$HARNESS" >"$NMS_LOG" 2>&1 &

    NMS_PID=$!

    wait_for_port "$RTMP_PORT" 50 ||
        fail "NMS did not listen on RTMP port $RTMP_PORT"

    assert_alive "$NMS_PID" "NMS"
}

start_proxy() {
    local case_dir="$1"

    PROXY_LOG="$case_dir/proxy.log"

    LISTEN_PORT="$PROXY_PORT" \
    UPSTREAM_PORT="$RTMP_PORT" \
    WARMUP=2 \
    TRICKLE_BYTES=1 \
    TRICKLE_INTERVAL=0.5 \
        python3 "$PROXY_SCRIPT" >"$PROXY_LOG" 2>&1 &

    PROXY_PID=$!

    wait_for_log "$PROXY_LOG" "listening 127.0.0.1:$PROXY_PORT" 50 ||
        fail "trickle proxy did not start"

    assert_alive "$PROXY_PID" "trickle proxy"
}

start_publisher() {
    local url="$1"
    local logfile="$2"

    ffmpeg \
        -nostdin \
        -hide_banner \
        -loglevel warning \
        -re \
        -f lavfi \
        -i 'testsrc2=size=320x180:rate=10' \
        -c:v libx264 \
        -preset ultrafast \
        -tune zerolatency \
        -g 20 \
        -keyint_min 20 \
        -sc_threshold 0 \
        -an \
        -f flv \
        "$url" \
        </dev/null \
        >"$logfile" 2>&1 &

    PUB_A_PID=$!
}

start_second_publisher() {
    local url="$1"
    local logfile="$2"

    ffmpeg \
        -nostdin \
        -hide_banner \
        -loglevel warning \
        -re \
        -f lavfi \
        -i 'testsrc2=size=320x180:rate=10' \
        -c:v libx264 \
        -preset ultrafast \
        -tune zerolatency \
        -g 20 \
        -keyint_min 20 \
        -sc_threshold 0 \
        -an \
        -f flv \
        "$url" \
        </dev/null \
        >"$logfile" 2>&1 &

    PUB_B_PID=$!
}

run_rejected_challenger() {
    local url="$1"
    local logfile="$2"
    local rc

    if timeout 5s ffmpeg \
        -nostdin \
        -hide_banner \
        -loglevel warning \
        -re \
        -f lavfi \
        -i 'testsrc2=size=320x180:rate=10' \
        -c:v libx264 \
        -preset ultrafast \
        -tune zerolatency \
        -g 20 \
        -keyint_min 20 \
        -sc_threshold 0 \
        -an \
        -f flv \
        "$url" \
        </dev/null \
        >"$logfile" 2>&1
    then
        rc=0
    else
        rc=$?
    fi

    if [[ "$rc" -eq 0 ]]; then
        fail "challenger unexpectedly exited successfully"
    fi

    if [[ "$rc" -eq 124 ]]; then
        fail "challenger timed out instead of being rejected"
    fi
}

test_default_off() {
    local case_dir="$WORKDIR/default-off"
    local url_a
    local url_b

    echo '===== TEST DEFAULT_OFF ====='

    mkdir -p "$case_dir"
    start_nms "$case_dir" ""
    start_proxy "$case_dir"

    url_a="rtmp://127.0.0.1:${PROXY_PORT}/live/stale-test"
    url_b="rtmp://127.0.0.1:${RTMP_PORT}/live/stale-test"

    start_publisher "$url_a" "$case_dir/publisher-a.log"

    wait_for_log "$NMS_LOG" "started push /live/stale-test" 100 ||
        fail "default-off publisher A was not accepted"

    wait_for_log "$PROXY_LOG" "trickle mode active" 100 ||
        fail "default-off proxy never entered trickle mode"

    # Longer than ping_timeout=2s while TCP activity continues every 0.5s.
    sleep 3

    assert_alive "$PUB_A_PID" "default-off publisher A"

    run_rejected_challenger \
        "$url_b" \
        "$case_dir/publisher-b.log"

    wait_for_log "$NMS_LOG" "already has a publisher" 50 ||
        fail "default-off challenger was not rejected"

    assert_no_log "$NMS_LOG" "stale publisher detected" ||
        fail "default-off mode performed stale recovery"

    assert_alive "$PUB_A_PID" "default-off publisher A"

    echo 'DEFAULT_OFF=PASS'
    cleanup_case
}

test_healthy_incumbent() {
    local case_dir="$WORKDIR/healthy-incumbent"
    local url

    echo '===== TEST HEALTHY_INCUMBENT ====='

    mkdir -p "$case_dir"
    start_nms "$case_dir" "2"

    url="rtmp://127.0.0.1:${RTMP_PORT}/live/stale-test"

    start_publisher "$url" "$case_dir/publisher-a.log"

    wait_for_log "$NMS_LOG" "started push /live/stale-test" 100 ||
        fail "healthy publisher A was not accepted"

    # Exceed publisher_stale_timeout while coded media continues normally.
    sleep 3

    assert_alive "$PUB_A_PID" "healthy publisher A"

    run_rejected_challenger \
        "$url" \
        "$case_dir/publisher-b.log"

    wait_for_log "$NMS_LOG" "already has a publisher" 50 ||
        fail "healthy challenger was not rejected"

    assert_no_log "$NMS_LOG" "stale publisher detected" ||
        fail "healthy incumbent was incorrectly classified as stale"

    assert_alive "$PUB_A_PID" "healthy publisher A"

    echo 'HEALTHY_INCUMBENT=PASS'
    cleanup_case
}

test_stale_recovery() {
    local case_dir="$WORKDIR/stale-recovery"
    local url_a
    local url_direct

    echo '===== TEST STALE_RECOVERY ====='

    mkdir -p "$case_dir"
    start_nms "$case_dir" "2"
    start_proxy "$case_dir"

    url_a="rtmp://127.0.0.1:${PROXY_PORT}/live/stale-test"
    url_direct="rtmp://127.0.0.1:${RTMP_PORT}/live/stale-test"

    start_publisher "$url_a" "$case_dir/publisher-a.log"

    wait_for_log "$NMS_LOG" "started push /live/stale-test" 100 ||
        fail "stale-test publisher A was not accepted"

    wait_for_log "$PROXY_LOG" "trickle mode active" 100 ||
        fail "stale-test proxy never entered trickle mode"

    # No complete coded A/V should arrive during this interval, while the
    # TCP socket still receives one byte every 0.5s.
    sleep 3

    assert_alive "$PUB_A_PID" "stale-test publisher A"

    run_rejected_challenger \
        "$url_direct" \
        "$case_dir/publisher-b-first.log"

    wait_for_log "$NMS_LOG" "stale publisher detected" 50 ||
        fail "stale incumbent was not detected"

    wait_for_log "$NMS_LOG" "already has a publisher" 50 ||
        fail "first challenger was not deliberately rejected"

    echo 'STALE_DETECTION=PASS'

    wait_for_log "$NMS_LOG" "[publisher] remove publisher" 50 ||
        fail "stale incumbent ownership was not cleaned up"

    echo 'STALE_CLEANUP=PASS'

    start_second_publisher \
        "$url_direct" \
        "$case_dir/publisher-b-retry.log"

    wait_for_count "$NMS_LOG" "[publisher] set publisher:" 2 100 ||
        fail "retry did not acquire publisher ownership"

    wait_for_count "$NMS_LOG" "started push /live/stale-test" 2 100 ||
        fail "retry did not start publishing"

    assert_alive "$PUB_B_PID" "retry publisher"

    echo 'RETRY_TAKEOVER=PASS'
    cleanup_case
}

echo "NMS_VERSION=$(node -p "require('./package.json').version")"
echo "TEST_WORKDIR=$WORKDIR"

test_default_off
test_healthy_incumbent
test_stale_recovery

echo 'TEST_RESULT=PASS'
