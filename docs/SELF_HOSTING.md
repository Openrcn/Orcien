# Self-hosting Orcien

Run the full Orcien platform locally: gateway, controller, ingress, a node agent, and
the console.

## Prerequisites

- Go 1.25+
- Docker (for the local provider)
- Node.js 20+ (only for the console)
- Linux/macOS; the ingress binds a privileged port by default

## 1. Build

```bash
git clone https://github.com/openrcn/orcien.git
cd orcien
make all
```

Produces `bin/gateway`, `bin/controller`, `bin/ingress`, `bin/node-agent`, and
`bin/resource-loader`.

## 2. Run the services

Four terminals (or a process manager):

```bash
./bin/gateway               # API on :8080
./bin/controller            # reconcile loop
sudo ./bin/ingress          # public ingress on :80 (privileged port)
make run-node-agent         # node agent: admin :9090, workload proxy :8081
```

The node agent needs access to the Docker socket (or run it with
`/var/run/docker.sock` mounted inside a container).

## 3. Run the console

```bash
cd apps/console
npm install
npm run dev                 # http://localhost:3000
```

Open the console, connect the bundled **Local** provider, pick or build a model card,
and deploy.

## Public URLs

A deployment serves on hostnames of the form:

```
http://<deployment>-<port>.<org>.localhost        # load-balanced across replicas
http://<deployment>-<node>-<port>.<org>.localhost # pinned to one replica
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
  -e NODE_AGENT_ADMIN_ADDRESS=0.0.0.0:9090 \
  -e NODE_AGENT_PROXY_ADDRESS=0.0.0.0:8080 \
  -e NODE_AGENT_ADMIN_TOKEN=orcn-dev-admin-token-2024 \
  -p 9090:9090 -p 8081:8080 \
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
| `API_PORT` | `8080` | Gateway API port |
| `INGRESS_PORT` | `80` | Public ingress port |
| `APP_DOMAIN` | `orcn.dev` | Base domain for public routes |
| `DATABASE_DSN` | `orcn.db` | Database connection (SQLite by default) |
| `CONTROL_PLANE_URL` | `http://127.0.0.1:8080` | Gateway URL used by the ingress |
| `INTERNAL_API_TOKEN` | `orcn-dev-internal-token` | Service-to-service token |
| `NODE_AGENT_ADMIN_ADDRESS` | `127.0.0.1:9090` | Agent admin API bind address |
| `NODE_AGENT_PROXY_ADDRESS` | `0.0.0.0:8081` | Agent workload proxy bind address |
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
