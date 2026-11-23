# Self-hosting Orcien

Run the full Orcien platform locally: gateway, controller, ingress, a node agent, and
the console.

## Prerequisites

- Go 1.25+
- Docker (for the local provider)
- Node.js 20+ (only for the console)
- Linux/macOS; all default ports are unprivileged, so no `sudo` is needed

## 1. Build

```bash
git clone https://github.com/openrcn/orcien.git
cd orcien
make all
```

Produces `bin/gateway`, `bin/controller`, `bin/ingress`, `bin/node-agent`, and
`bin/resource-loader`.

## 2. Run the services

Recommended: one command, one terminal, colored per-service logs:

```bash
make dev                 # gateway + controller + ingress
make dev-console         # same, plus the Next.js console
```

`scripts/dev.sh` checks the ports, builds once, starts everything, prefixes each
line with an arrow/tag (`GATEWAY ➜`, `CONTROLLER ➜`, `INGRESS ➜`, and
`AGENT ➜` when enabled), and stops the whole stack on Ctrl+C. Useful flags:
`--no-build`, `--console`, and `--agent` to opt into the node agent. For now the
node agent is not part of the default `make dev` run.

Manual alternative (one terminal per process):

```bash
./bin/gateway               # API on :27100
./bin/controller            # reconcile loop (no listener)
./bin/ingress               # public ingress on :27101
make run-node-agent         # node agent: admin :27102, workload proxy :27103
```

The default local port block is:

| Service | Port |
| --- | ---: |
| Gateway API | `27100` |
| Public ingress | `27101` |
| Node agent admin | `27102` |
| Node agent proxy | `27103` |
| Console dev server | `27104` |

These live in `.env`; override them there (or on the command line) instead of
editing code.

The node agent needs access to the Docker socket (or run it with
`/var/run/docker.sock` mounted inside a container).

## 3. Run the console

```bash
cd apps/console
npm install
npm run dev -- -p 27104     # http://localhost:27104
```

Or from the repo root, `make dev-console` starts it with the same port and
colored logs alongside the backend.

Open the console, connect the bundled **Local** provider, pick or build a model card,
and deploy.

## Public URLs

A deployment serves on hostnames of the form:

```
http://<deployment>-<port>.<org>.localhost:27101        # load-balanced across replicas
http://<deployment>-<node>-<port>.<org>.localhost:27101 # pinned to one replica
```

Route keys are DNS-slugified, so `node_test` becomes `node-test`. With a real domain,
set `APP_DOMAIN` (for example `orcn.dev`) and point `*.<APP_DOMAIN>` at the ingress.

## Node agent

### Persistence

The agent persists registered job specs and re-adopts existing containers after a
restart. Keep the state file on a mounted volume when running in Docker:

```bash
docker run -d --name orcn-node-agent \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$PWD/data:/app/data" \
  -e NODE_AGENT_STATE_PATH=/app/data/node-agent-jobs.json \
  -e NODE_AGENT_ADMIN_ADDRESS=0.0.0.0:27102 \
  -e NODE_AGENT_PROXY_ADDRESS=0.0.0.0:27103 \
  -e NODE_AGENT_ADMIN_TOKEN=orcn-dev-admin-token-2024 \
  -p 27102:27102 -p 27103:27103 \
  orcn/node-agent:latest
```

### Workload networking

Workload containers are attached to a Docker network that the agent itself can reach.
Docker blocks traffic between different bridge networks, so the default is `bridge`
(the network the agent normally runs on). If the agent joins a custom network, set:

```bash
NODE_AGENT_WORKLOAD_NETWORK=infra_orcn-net
```

In that case attach the agent container to the same network
(`docker network connect infra_orcn-net orcn-node-agent`), otherwise health checks and
the proxy will time out.

### GPU

If a spec requests `gpu: true`, Docker runs the NVIDIA prestart hook. On hosts without
a usable GPU (including WSL without GPU adapters) container creation fails. Deploy such
workloads with GPU disabled, or run the agent on a GPU-capable host.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `API_PORT` | `27100` | Gateway API port |
| `INGRESS_PORT` | `27101` | Public ingress port |
| `APP_DOMAIN` | `orcn.dev` | Base domain for public routes |
| `DATABASE_DSN` | `orcn.db` | Database connection (SQLite by default) |
| `CONTROL_PLANE_URL` | `http://127.0.0.1:27100` | Gateway URL used by the ingress |
| `INTERNAL_API_TOKEN` | `orcn-dev-internal-token` | Service-to-service token |
| `NODE_AGENT_ADMIN_PORT` | `27102` | Agent admin port; binds `127.0.0.1` by default |
| `NODE_AGENT_PROXY_PORT` | `27103` | Agent workload proxy port; binds `0.0.0.0` by default |
| `NODE_AGENT_ADMIN_ADDRESS` | `127.0.0.1:27102` | Optional full admin bind address override |
| `NODE_AGENT_PROXY_ADDRESS` | `0.0.0.0:27103` | Optional full proxy bind address override |
| `CONSOLE_PORT` | `27104` | Next.js dev server port |
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:27100` | Gateway origin used by the console |
| `NODE_AGENT_ADMIN_TOKEN` | — | Token the control plane uses to register jobs |
| `NODE_AGENT_WORKLOAD_NETWORK` | `bridge` | Docker network for workload containers |
| `NODE_AGENT_STATE_PATH` | `data/node-agent-jobs.json` | Persisted agent registrations |
| `GATEWAY_SYNC_INTERVAL_SEC` | `5` | Ingress route-cache sync interval |
| `CONTROLLER_SYNC_INTERVAL_SEC` | `15` | Reconcile loop interval |

## Troubleshooting

- **`Service not found or no healthy nodes available`** — the ingress has no route for
  that host, or no replica is `READY`. Check `GET /api/v1/deployments`, the node's
  `InfraStatus`/`AppStatus`, and that the ingress can reach the gateway with a valid
  `INTERNAL_API_TOKEN`.
- **Deployment stuck in `DRAFT`** — the node never registered or never became healthy.
  Check node-agent logs, the admin token, and container health.
- **Proxy `i/o timeout`** — the agent and the workload container are on different Docker
  networks; see [Workload networking](#workload-networking).
