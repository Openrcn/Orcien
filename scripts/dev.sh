#!/usr/bin/env bash
#
# Run the local ORCN backend stack in one terminal.
#
#   ./scripts/dev.sh                 # gateway + controller + ingress + node-agent
#   ./scripts/dev.sh --console      # also start the Next.js console
#   ./scripts/dev.sh --no-agent     # skip the Docker-backed node agent
#   ./scripts/dev.sh --no-build     # reuse existing binaries in bin/
#
# Each service gets a distinct color and an arrow prefix, e.g. "GATEWAY ➜".
# Ctrl+C stops the whole group cleanly.

set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="${ROOT}/scripts/$(basename "${BASH_SOURCE[0]}")"
cd "$ROOT"

# Load the single local port block. .env is optional; the fallbacks below match
# core/config and services/node-agent/config.
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env
  set +a
fi

API_PORT="${API_PORT:-27100}"
INGRESS_PORT="${INGRESS_PORT:-27101}"
CONTROL_PLANE_URL="${CONTROL_PLANE_URL:-http://127.0.0.1:${API_PORT}}"
NODE_AGENT_ADMIN_PORT="${NODE_AGENT_ADMIN_PORT:-27102}"
NODE_AGENT_PROXY_PORT="${NODE_AGENT_PROXY_PORT:-27103}"
NODE_AGENT_ADMIN_ADDRESS="${NODE_AGENT_ADMIN_ADDRESS:-127.0.0.1:${NODE_AGENT_ADMIN_PORT}}"
NODE_AGENT_PROXY_ADDRESS="${NODE_AGENT_PROXY_ADDRESS:-0.0.0.0:${NODE_AGENT_PROXY_PORT}}"
NODE_AGENT_ADMIN_TOKEN="${NODE_AGENT_ADMIN_TOKEN:-orcn-dev-admin-token-2024}"
CONSOLE_PORT="${CONSOLE_PORT:-27104}"
NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://127.0.0.1:${API_PORT}}"

AGENT_MODE="${AGENT_MODE:-shared}"
MAX_WORKLOAD_COUNT="${MAX_WORKLOAD_COUNT:-10}"
NODE_AGENT_TELEMETRY_ENABLED="${NODE_AGENT_TELEMETRY_ENABLED:-true}"
NODE_AGENT_HEALTHCHECK_ENABLED="${NODE_AGENT_HEALTHCHECK_ENABLED:-true}"
NODE_AGENT_LOG_LEVEL="${NODE_AGENT_LOG_LEVEL:-info}"

export API_PORT INGRESS_PORT CONTROL_PLANE_URL
export NODE_AGENT_ADMIN_PORT NODE_AGENT_PROXY_PORT
export NODE_AGENT_ADMIN_ADDRESS NODE_AGENT_PROXY_ADDRESS NODE_AGENT_ADMIN_TOKEN
export CONSOLE_PORT NEXT_PUBLIC_API_URL
export AGENT_MODE MAX_WORKLOAD_COUNT NODE_AGENT_TELEMETRY_ENABLED
export NODE_AGENT_HEALTHCHECK_ENABLED NODE_AGENT_LOG_LEVEL

NODE_AGENT_ADMIN_PORT="${NODE_AGENT_ADMIN_ADDRESS##*:}"
NODE_AGENT_PROXY_PORT="${NODE_AGENT_PROXY_ADDRESS##*:}"

# Child mode: execute one service and prefix every output line.
if [[ "${1:-}" == "__run" ]]; then
  shift
  name="${1:-service}"
  color="${2:-36}"
  shift 2

  printf -v prefix '\033[%sm%s ➜\033[0m ' "$color" "$name"
  set -o pipefail
  if command -v stdbuf >/dev/null 2>&1; then
    stdbuf -oL -eL "$@" 2>&1 | sed -u "s/^/${prefix}/"
  else
    "$@" 2>&1 | sed -u "s/^/${prefix}/"
  fi
  exit "${PIPESTATUS[0]}"
fi

BUILD=1
WITH_AGENT=0
WITH_CONSOLE=0

usage() {
  cat <<EOF
Usage: ./scripts/dev.sh [options]

Runs gateway + controller + ingress by default.

Options:
  --agent        Also start the node agent (future opt-in)
  --no-build     Reuse binaries already in bin/
  --console      Also start the Next.js console
  -h, --help     Show this help

Ports come from .env (fallbacks: gateway 27100, ingress 27101,
agent admin 27102, agent proxy 27103, console 27104).
EOF
}

for arg in "$@"; do
  case "$arg" in
    --agent) WITH_AGENT=1 ;;
    --no-agent) WITH_AGENT=0 ;;
    --no-build) BUILD=0 ;;
    --console) WITH_CONSOLE=1 ;;
    -h|--help) usage; exit 0 ;;
    *)
      printf 'Unknown option: %s\n\n' "$arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

pids=()
LAST_PID=""
HAS_SETSID=0
if command -v setsid >/dev/null 2>&1; then
  HAS_SETSID=1
fi

cleanup() {
  local code=$?
  trap - EXIT INT TERM

  # Ctrl+C / SIGTERM is the normal way to stop the dev stack.
  if ((code == 130 || code == 143)); then
    code=0
  fi

  if ((${#pids[@]} == 0)); then
    exit "$code"
  fi

  printf '\n\033[2mStopping ORCN dev stack...\033[0m\n'
  for pid in "${pids[@]}"; do
    if ((HAS_SETSID)); then
      kill -TERM -- "-${pid}" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    else
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done

  for _ in {1..30}; do
    local alive=0
    for pid in "${pids[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        alive=1
      fi
    done
    if ((alive == 0)); then
      break
    fi
    sleep 0.1
  done

  for pid in "${pids[@]}"; do
    if ((HAS_SETSID)); then
      kill -KILL -- "-${pid}" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
    else
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
  exit "$code"
}
trap cleanup EXIT INT TERM

start_service() {
  local name="$1"
  local color="$2"
  shift 2

  if ((HAS_SETSID)); then
    setsid "$SCRIPT" __run "$name" "$color" "$@" &
  else
    "$SCRIPT" __run "$name" "$color" "$@" &
  fi
  LAST_PID=$!
  pids+=("$LAST_PID")
}

port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    local out
    out="$(ss -ltnH "sport = :${port}" 2>/dev/null || true)"
    [[ -n "$out" ]]
    return
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
    return
  fi
  (exec 3<>"/dev/tcp/127.0.0.1/${port}") 2>/dev/null
}

check_port() {
  local port="$1"
  local name="$2"
  if port_in_use "$port"; then
    printf '\033[31mPort %s is already in use (%s).\033[0m\n' "$port" "$name" >&2
    printf 'Change it in .env, then run again.\n' >&2
    return 1
  fi
}

wait_for_port() {
  local port="$1"
  local name="$2"
  local pid="$3"
  local timeout="${4:-30}"
  local deadline=$((SECONDS + timeout))

  while ((SECONDS < deadline)); do
    if (exec 3<>"/dev/tcp/127.0.0.1/${port}") 2>/dev/null; then
      return 0
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      printf '\033[31m%s exited before opening port %s.\033[0m\n' "$name" "$port" >&2
      return 1
    fi
    sleep 0.1
  done

  printf '\033[31mTimed out waiting for %s on port %s.\033[0m\n' "$name" "$port" >&2
  return 1
}

printf '\n\033[1mORCN local dev stack\033[0m\n'
printf '  gateway     \033[36mhttp://127.0.0.1:%s\033[0m\n' "$API_PORT"
printf '  ingress     \033[33mhttp://127.0.0.1:%s\033[0m\n' "$INGRESS_PORT"
if ((WITH_AGENT)); then
  printf '  agent admin \033[32mhttp://127.0.0.1:%s\033[0m\n' "$NODE_AGENT_ADMIN_PORT"
  printf '  agent proxy \033[32mhttp://127.0.0.1:%s\033[0m\n' "$NODE_AGENT_PROXY_PORT"
fi
if ((WITH_CONSOLE)); then
  printf '  console     \033[34mhttp://127.0.0.1:%s\033[0m\n' "$CONSOLE_PORT"
fi
printf '  Ctrl+C stops everything\n\n'

check_port "$API_PORT" "gateway"
check_port "$INGRESS_PORT" "ingress"
if ((WITH_AGENT)); then
  check_port "$NODE_AGENT_ADMIN_PORT" "node agent admin"
  check_port "$NODE_AGENT_PROXY_PORT" "node agent proxy"
fi
if ((WITH_CONSOLE)); then
  check_port "$CONSOLE_PORT" "console"
fi

if ((BUILD)); then
  printf '\033[2mBuilding services...\033[0m\n'
  mkdir -p bin
  services=(./cmd/gateway ./cmd/controller ./cmd/ingress)
  if ((WITH_AGENT)); then
    services+=(./cmd/node-agent)
  fi
  go build -o bin/ "${services[@]}"
fi

for binary in gateway controller ingress; do
  if [[ ! -x "bin/${binary}" ]]; then
    printf '\033[31mMissing bin/%s; run without --no-build.\033[0m\n' "$binary" >&2
    exit 1
  fi
done
if ((WITH_AGENT)) && [[ ! -x bin/node-agent ]]; then
  printf '\033[31mMissing bin/node-agent; run without --no-build.\033[0m\n' >&2
  exit 1
fi

start_service GATEWAY 36 ./bin/gateway
GATEWAY_PID=$LAST_PID
wait_for_port "$API_PORT" "GATEWAY" "$GATEWAY_PID"

start_service CONTROLLER 35 ./bin/controller
start_service INGRESS 33 ./bin/ingress

if ((WITH_AGENT)); then
  start_service AGENT 32 ./bin/node-agent
fi

if ((WITH_CONSOLE)); then
  if [[ ! -d apps/console/node_modules ]]; then
    printf '\033[31mapps/console/node_modules is missing; run npm install in apps/console.\033[0m\n' >&2
    exit 1
  fi
  start_service CONSOLE 34 npm --prefix apps/console run dev -- -p "$CONSOLE_PORT"
fi

# Stop the whole stack as soon as any service exits, and on Ctrl+C.
wait -n
