package ingress

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"orcn/core"
	"orcn/core/logger"
	"orcn/models"
	"orcn/pkg/balancer"
	"orcn/pkg/routing"
)

var ingressLog = logger.New("INGRESS")

type CachedNode struct {
	ID          string
	TargetURL   *url.URL
	ContainerID string
	Port        int
	Active      int32
}

type CachedRoute struct {
	Name        string
	RealModelID string
	Kind        string
	Policy      AdmissionPolicy
	Nodes       []*CachedNode
	Balancer    balancer.LoadBalancer[*CachedNode]
}

type Server struct {
	apiURL string
	cfg    Config

	mu                 sync.RWMutex
	routes             map[string]*CachedRoute
	admission          *AdmissionController
	syncClient         *http.Client
	lastSyncNS         atomic.Int64
	workloadTransport  *http.Transport
	inferenceTransport *http.Transport
}

func New(apiURL string, cfg Config) *Server {
	s := &Server{
		apiURL:             apiURL,
		cfg:                cfg,
		routes:             make(map[string]*CachedRoute),
		admission:          NewAdmissionController(cfg),
		syncClient:         &http.Client{Timeout: 10 * time.Second},
		workloadTransport:  newTransport(cfg),
		inferenceTransport: newTransport(cfg),
	}
	s.StartCacheSync()
	return s
}

func (s *Server) StartCacheSync() {
	ingressLog.Info("Starting highly-optimized memory cache sync...")
	go func() {
		time.Sleep(1 * time.Second)
		s.syncRoutes()
		for {
			time.Sleep(s.cfg.SyncInterval)
			s.syncRoutes()
		}
	}()
}

func (s *Server) syncRoutes() {
	req, err := http.NewRequest(http.MethodGet, s.apiURL, nil)
	if err != nil {
		ingressLog.Error("Invalid route API URL: %v", err)
		return
	}
	if s.cfg.InternalAPIToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.cfg.InternalAPIToken)
	}
	resp, err := s.syncClient.Do(req)
	if err != nil {
		ingressLog.Error("Error syncing routes from API: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		ingressLog.Error("API returned non-200 status: %d", resp.StatusCode)
		return
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		ingressLog.Error("Error reading API response: %v", err)
		return
	}

	var deps []models.Deployment
	if err := json.Unmarshal(body, &deps); err != nil {
		ingressLog.Error("Error parsing API response: %v", err)
		return
	}

	newRoutes := make(map[string]*CachedRoute)

	type routeTarget struct {
		nodeID      string
		targetURL   *url.URL
		containerID string
		port        int
	}

	addNodeToRoute := func(routeName string, target routeTarget, modelID, kind string, policy AdmissionPolicy) {
		routeKey := strings.ToLower(routing.SlugLabel(routeName))
		if _, exists := newRoutes[routeKey]; !exists {
			newRoutes[routeKey] = &CachedRoute{
				Name:        routeKey,
				RealModelID: modelID,
				Kind:        kind,
				Policy:      policy,
				Nodes:       []*CachedNode{},
				Balancer:    balancer.New[*CachedNode](balancer.StrategyRoundRobin),
			}
		}

		for _, n := range newRoutes[routeKey].Nodes {
			if n.ID == target.nodeID {
				return
			}
		}

		newRoutes[routeKey].Nodes = append(newRoutes[routeKey].Nodes, &CachedNode{
			ID:          target.nodeID,
			TargetURL:   target.targetURL,
			ContainerID: target.containerID,
			Port:        target.port,
		})
	}

	for _, d := range deps {
		for _, node := range d.Nodes {
			if node.AppStatus != models.AppReady {
				continue
			}

			var endpoints []core.Endpoint
			if err := json.Unmarshal([]byte(node.EndpointsJSON), &endpoints); err == nil && len(endpoints) > 0 {

				shortNodeID := strings.ToLower(node.ID)
				if len(shortNodeID) > 8 {
					shortNodeID = shortNodeID[:8]
				}
				policy := AdmissionPolicy{
					RequestsPerMinute:     d.RequestsPerMinute,
					BurstRequests:         d.BurstRequests,
					MaxConcurrentRequests: d.MaxConcurrentRequests,
				}

				ep0 := endpoints[0]
				for _, endpoint := range endpoints {
					if endpoint.Primary {
						ep0 = endpoint
						break
					}
				}

				parseEndpointURL := func(ep core.Endpoint) (*url.URL, bool) {
					targetURLStr := ep.BaseURL
					if !strings.HasPrefix(targetURLStr, "http") {
						proto := "http"
						if ep.Protocol != "" {
							proto = ep.Protocol
						}
						targetURLStr = proto + "://" + ep.BaseURL
					}
					parsed, err := url.Parse(targetURLStr)
					return parsed, err == nil
				}

				if parsedURL0, ok := parseEndpointURL(ep0); ok {
					primary := routeTarget{nodeID: node.ID, targetURL: parsedURL0, containerID: ep0.ContainerID, port: ep0.Port}
					addNodeToRoute(d.RouteKey, primary, d.ModelID, d.WorkloadType, policy)
					// Primary node-specific route: <shortNodeID>.<routeKey>
					if shortNodeID != "" {
						addNodeToRoute(fmt.Sprintf("%s.%s", shortNodeID, d.RouteKey), primary, d.ModelID, d.WorkloadType, policy)
					}
				}

				// Per-port node-specific routes: <shortNodeID>-<port>.<routeKey>
				if shortNodeID != "" {
					for _, ep := range endpoints {
						if ep.Port <= 0 {
							continue
						}
						if parsedURL, ok := parseEndpointURL(ep); ok {
							target := routeTarget{nodeID: node.ID, targetURL: parsedURL, containerID: ep.ContainerID, port: ep.Port}
							addNodeToRoute(fmt.Sprintf("%s-%d.%s", shortNodeID, ep.Port, d.RouteKey), target, d.ModelID, d.WorkloadType, policy)
						}
					}
				}
			}
		}
	}

	s.mu.Lock()
	s.routes = newRoutes
	s.mu.Unlock()
	s.lastSyncNS.Store(time.Now().UnixNano())
}

func (s *Server) Handler() http.Handler {
	handler := func(w http.ResponseWriter, r *http.Request) {

		host := r.Host

		if strings.Contains(host, ":") {
			host = strings.Split(host, ":")[0]
		}

		var routeKey string
		var matched bool

		// Check AppDomain (e.g., orcn.dev)
		if host == s.cfg.AppDomain {
			matched = true
		} else if strings.HasSuffix(host, "."+s.cfg.AppDomain) {
			// The stored route key is DNS-slugified ("node_test" -> "node-test"),
			// so arriving hosts must go through the same transformation.
			routeKey = routing.SlugLabel(strings.TrimSuffix(host, "."+s.cfg.AppDomain))
			matched = true
		}

		// Allow localhost for development (any port)
		if !matched && (host == "localhost" || strings.HasSuffix(host, ".localhost")) {
			if host == "localhost" {
				matched = true
			} else {
				routeKey = routing.SlugLabel(strings.TrimSuffix(host, ".localhost"))
				matched = true
			}
		}

		if !matched {
			http.NotFound(w, r)
			return
		}

		if routeKey == "" {
			http.NotFound(w, r)
			return
		}

		if s.routesAreStale() {
			http.Error(w, "Ingress route data is stale", http.StatusServiceUnavailable)
			return
		}

		s.mu.RLock()
		route, exists := s.routes[routeKey]
		s.mu.RUnlock()

		if !exists || len(route.Nodes) == 0 {
			http.Error(w, "Service not found or no healthy nodes available on Ingress Gateway", http.StatusNotFound)
			return
		}

		release, err := s.admission.Acquire(route.Name, route.Kind, route.Policy)
		if err != nil {
			retryAfter := "1"
			if err == ErrRateLimited {
				retryAfter = "60"
			}
			w.Header().Set("Retry-After", retryAfter)
			http.Error(w, "Request rejected by ingress admission policy", http.StatusTooManyRequests)
			return
		}
		defer release()

		var healthyNodes []*CachedNode
		s.mu.RLock()
		for _, n := range route.Nodes {
			healthyNodes = append(healthyNodes, n)
		}
		s.mu.RUnlock()

		if len(healthyNodes) == 0 {
			http.Error(w, "All nodes for this service are currently unhealthy or penalized", http.StatusBadGateway)
			return
		}

		targetNode, err := route.Balancer.Pick(healthyNodes)
		if err != nil {
			http.Error(w, "No ready nodes available", http.StatusBadGateway)
			return
		}

		proxy := httputil.NewSingleHostReverseProxy(targetNode.TargetURL)
		proxy.Transport = s.transportFor(route.Kind)
		proxy.FlushInterval = 100 * time.Millisecond

		originalDirector := proxy.Director
		proxy.Director = func(req *http.Request) {
			originalDirector(req)
			req.Host = targetNode.TargetURL.Host
			if targetNode.ContainerID != "" {
				req.Header.Set("X-Orcn-Container", targetNode.ContainerID)
			}
			if targetNode.Port != 0 {
				req.Header.Set("X-Orcn-Port", fmt.Sprintf("%d", targetNode.Port))
			}
		}

		proxy.ErrorHandler = func(w http.ResponseWriter, req *http.Request, proxyErr error) {
			ingressLog.Error("Proxy error for generic container %s (Node: %s): %v", routeKey, targetNode.ID, proxyErr)
			http.Error(w, "Bad Gateway: Node failed to respond", http.StatusBadGateway)
		}

		proxy.ServeHTTP(w, r)
	}

	return http.HandlerFunc(handler)
}

func (s *Server) routesAreStale() bool {
	if s.cfg.RouteStaleAfter <= 0 {
		return false
	}
	last := s.lastSyncNS.Load()
	return last == 0 || time.Since(time.Unix(0, last)) > s.cfg.RouteStaleAfter
}

func (s *Server) transportFor(kind string) *http.Transport {
	if kind == "workload" {
		return s.workloadTransport
	}
	return s.inferenceTransport
}

func newTransport(cfg Config) *http.Transport {
	maxConns := cfg.MaxConnsPerHost
	if maxConns <= 0 {
		maxConns = 200
	}
	return &http.Transport{
		DialContext: (&net.Dialer{
			Timeout:   15 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          1000,
		MaxIdleConnsPerHost:   maxConns,
		MaxConnsPerHost:       maxConns,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}
}