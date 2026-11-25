package api

import (
	"net/http"

	"orcn/core/config"
)

// rateLimitDefaults is the effective policy ingress applies when a deployment
// leaves its policy fields at 0. The console renders these values so operators
// can change defaults in .env without touching frontend code.
type rateLimitDefaults struct {
	RequestsPerMinute           int `json:"requests_per_minute"`
	BurstRequests               int `json:"burst_requests"`
	MaxConcurrentRequests       int `json:"max_concurrent_requests"`
	MaxRequestsPerMinute        int `json:"max_requests_per_minute"`
	GlobalRequestsPerMinute     int `json:"global_requests_per_minute"`
	GlobalMaxConcurrentRequests int `json:"global_max_concurrent_requests"`
}

type ingressDefaultsResponse struct {
	Inference rateLimitDefaults `json:"inference"`
	Workload  rateLimitDefaults `json:"workload"`
}

func (s *Server) handleGetIngressDefaults(w http.ResponseWriter, _ *http.Request) {
	cfg := s.Cfg
	respondJSON(w, http.StatusOK, ingressDefaultsResponse{
		Inference: rateLimitDefaults{
			RequestsPerMinute:           cfg.IngressInferenceDefaultRPM,
			BurstRequests:               effectiveBurst(cfg.IngressInferenceDefaultBurst, cfg.IngressInferenceDefaultRPM),
			MaxConcurrentRequests:       cfg.IngressInferenceDefaultConcurrent,
			MaxRequestsPerMinute:        cfg.IngressInferenceMaxRPM,
			GlobalRequestsPerMinute:     cfg.IngressInferenceGlobalRPM,
			GlobalMaxConcurrentRequests: cfg.IngressInferenceGlobalConcurrent,
		},
		Workload: rateLimitDefaults{
			RequestsPerMinute:           cfg.IngressWorkloadDefaultRPM,
			BurstRequests:               effectiveBurst(cfg.IngressWorkloadDefaultBurst, cfg.IngressWorkloadDefaultRPM),
			MaxConcurrentRequests:       cfg.IngressWorkloadDefaultConcurrent,
			MaxRequestsPerMinute:        cfg.IngressWorkloadMaxRPM,
			GlobalRequestsPerMinute:     cfg.IngressWorkloadGlobalRPM,
			GlobalMaxConcurrentRequests: cfg.IngressWorkloadGlobalConcurrent,
		},
	})
}

// Keep the published burst in sync with ingress' effective policy: the
// configured default is capped by RPM, falling back to the shared helper.
func effectiveBurst(configured, rpm int) int {
	if configured <= 0 {
		configured = config.DefaultBurst(rpm)
	}
	if rpm > 0 && configured > rpm {
		return rpm
	}
	return configured
}
