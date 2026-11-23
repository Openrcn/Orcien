.PHONY: all build-gateway build-controller build-ingress build-node-agent build-resource-loader run-gateway run-controller run-ingress run-node-agent dev dev-console clean docker-node-agent

# Load the local port block once. .env is optional; the defaults below match
# core/config and services/node-agent/config.
-include .env

API_PORT ?= 27100
INGRESS_PORT ?= 27101
CONTROL_PLANE_URL ?= http://127.0.0.1:$(API_PORT)
NODE_AGENT_ADMIN_PORT ?= 27102
NODE_AGENT_PROXY_PORT ?= 27103
NODE_AGENT_ADMIN_ADDRESS ?= 127.0.0.1:$(NODE_AGENT_ADMIN_PORT)
NODE_AGENT_PROXY_ADDRESS ?= 0.0.0.0:$(NODE_AGENT_PROXY_PORT)
NODE_AGENT_ADMIN_TOKEN ?= orcn-dev-admin-token-2024
CONSOLE_PORT ?= 27104
NEXT_PUBLIC_API_URL ?= http://127.0.0.1:$(API_PORT)

export API_PORT INGRESS_PORT CONTROL_PLANE_URL
export NODE_AGENT_ADMIN_PORT NODE_AGENT_PROXY_PORT
export NODE_AGENT_ADMIN_ADDRESS NODE_AGENT_PROXY_ADDRESS NODE_AGENT_ADMIN_TOKEN
export CONSOLE_PORT NEXT_PUBLIC_API_URL

# Override when a shared Go build cache is desired. /tmp works in restricted
# containers and keeps `make build-*` independent of a read-only user cache.
ORCN_GO_CACHE ?= /tmp/orcn-go-build

# Default target
all: build-gateway build-controller build-ingress build-node-agent build-resource-loader

# ==========================================
# Gateway Service
# ==========================================

build-gateway:
	@echo "Building Gateway Service..."
	@mkdir -p bin
	@go build -o bin/gateway ./cmd/gateway
	@echo "Build complete! Binary located at: bin/gateway"

run-gateway:
	@echo "Starting Gateway Service..."
	@go run ./cmd/gateway

# ==========================================
# Controller Service
# ==========================================

build-controller:
	@echo "Building Controller Service..."
	@mkdir -p bin
	@go build -o bin/controller ./cmd/controller
	@echo "Build complete! Binary located at: bin/controller"

run-controller:
	@echo "Starting Controller Service..."
	@go run ./cmd/controller

# ==========================================
# Public Ingress Service
# ==========================================

build-ingress:
	@echo "Building Ingress Service..."
	@mkdir -p bin
	@GOCACHE=$(ORCN_GO_CACHE) go build -o bin/ingress ./cmd/ingress
	@echo "Build complete! Binary located at: bin/ingress"

run-ingress:
	@echo "Starting Ingress Service..."
	@go run ./cmd/ingress

# ==========================================
# Node Agent
# ==========================================

build-node-agent:
	@echo "Building Node Agent..."
	@mkdir -p bin
	@go build -o bin/node-agent ./cmd/node-agent
	@echo "Build complete! Binary located at: bin/node-agent"

run-node-agent:
	@if [ "$(DETACH)" = "1" ]; then \
		echo "Starting Node Agent (background)..."; \
		NODE_AGENT_ADMIN_ADDRESS=$(NODE_AGENT_ADMIN_ADDRESS) \
		NODE_AGENT_PROXY_ADDRESS=$(NODE_AGENT_PROXY_ADDRESS) \
		NODE_AGENT_ADMIN_TOKEN=$(NODE_AGENT_ADMIN_TOKEN) \
		AGENT_MODE=shared \
		MAX_WORKLOAD_COUNT=10 \
		NODE_AGENT_TELEMETRY_ENABLED=true \
		NODE_AGENT_HEALTHCHECK_ENABLED=true \
		NODE_AGENT_LOG_LEVEL=info \
		go run ./cmd/node-agent > /tmp/node-agent.log 2>&1 & echo $$! > /tmp/node-agent.pid; \
		echo "Node Agent started in background (PID: $$(cat /tmp/node-agent.pid))"; \
		echo "Admin Token: $(NODE_AGENT_ADMIN_TOKEN)"; \
		echo "Admin: http://$(NODE_AGENT_ADMIN_ADDRESS)"; \
		echo "Proxy: http://$(NODE_AGENT_PROXY_ADDRESS)"; \
		echo "Logs: tail -f /tmp/node-agent.log"; \
	else \
		echo "Starting Node Agent (foreground)..."; \
		NODE_AGENT_ADMIN_ADDRESS=$(NODE_AGENT_ADMIN_ADDRESS) \
		NODE_AGENT_PROXY_ADDRESS=$(NODE_AGENT_PROXY_ADDRESS) \
		NODE_AGENT_ADMIN_TOKEN=$(NODE_AGENT_ADMIN_TOKEN) \
		AGENT_MODE=shared \
		MAX_WORKLOAD_COUNT=10 \
		NODE_AGENT_TELEMETRY_ENABLED=true \
		NODE_AGENT_HEALTHCHECK_ENABLED=true \
		NODE_AGENT_LOG_LEVEL=info \
		go run ./cmd/node-agent; \
	fi

stop-node-agent:
	@if [ -f /tmp/node-agent.pid ]; then kill $$(cat /tmp/node-agent.pid) && rm /tmp/node-agent.pid && echo "Node Agent stopped"; else echo "No PID file found"; fi

# ==========================================
# Resource Loader (sidecar for node-agent)
# ==========================================

build-resource-loader:
	@echo "Building Resource Loader..."
	@mkdir -p bin
	@go build -o bin/resource-loader ./services/node-agent/resource-loader
	@echo "Build complete! Binary located at: bin/resource-loader"

# ==========================================
# Docker
# ==========================================

docker-node-agent:
	@echo "Building Node Agent Docker image..."
	@docker build -t orcn/node-agent:latest -f services/node-agent/Dockerfile .
	@echo "Docker image built: orcn/node-agent:latest"

docker-resource-loader:
	@echo "Building Resource Loader Docker image..."
	@docker build -t vinitngr/orcn-resource-loader:dev -f services/node-agent/resource-loader/Dockerfile .
	@echo "Docker image built: vinitngr/orcn-resource-loader:dev"

docker-gateway:
	@echo "Building Gateway Docker image..."
	@docker build -t orcn/gateway:latest -f services/gateway/Dockerfile .
	@echo "Docker image built: orcn/gateway:latest"

run-node-agent-docker:
	@echo "Running Node Agent Docker container..."
	@docker run -d \
		--name orcn-node-agent \
		--restart unless-stopped \
		-p $(NODE_AGENT_ADMIN_PORT):$(NODE_AGENT_ADMIN_PORT) \
		-p $(NODE_AGENT_PROXY_PORT):$(NODE_AGENT_PROXY_PORT) \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-e NODE_AGENT_ADMIN_ADDRESS=0.0.0.0:$(NODE_AGENT_ADMIN_PORT) \
		-e NODE_AGENT_PROXY_ADDRESS=0.0.0.0:$(NODE_AGENT_PROXY_PORT) \
		-e NODE_AGENT_ADMIN_TOKEN=$(NODE_AGENT_ADMIN_TOKEN) \
		-e AGENT_MODE=shared \
		-e MAX_WORKLOAD_COUNT=10 \
		-e NODE_AGENT_TELEMETRY_ENABLED=true \
		-e NODE_AGENT_HEALTHCHECK_ENABLED=true \
		-e NODE_AGENT_LOG_LEVEL=info \
		orcn/node-agent:latest
	@docker network connect infra_orcn-net orcn-node-agent 2>/dev/null || true
	@echo "Node Agent container started: orcn-node-agent"
	@echo "Admin Token: $(NODE_AGENT_ADMIN_TOKEN)"
	@echo "Admin: http://127.0.0.1:$(NODE_AGENT_ADMIN_PORT)"
	@echo "Proxy: http://127.0.0.1:$(NODE_AGENT_PROXY_PORT)"

stop-node-agent-docker:
	@docker stop orcn-node-agent && docker rm orcn-node-agent
	@echo "Node Agent container stopped and removed"

logs-node-agent-docker:
	@docker logs -f orcn-node-agent

# ==========================================
# Local development stack
# ==========================================

# Builds once and runs gateway + controller + ingress with colored, prefixed
# logs in one terminal. Pass ARGS="--agent" to include the node agent later.
# Ctrl+C stops everything.
dev:
	@exec ./scripts/dev.sh $(ARGS)

# Same stack plus the Next.js console.
dev-console:
	@exec ./scripts/dev.sh --console $(ARGS)

# ==========================================
# Utilities
# ==========================================

clean:
	@echo "Cleaning up bin directory..."
	@rm -rf bin/
	@echo "Clean complete."
