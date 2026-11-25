package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orcn/core/config"
)

func TestGetIngressDefaultsReflectsConfig(t *testing.T) {
	cfg := &config.Config{
		IngressInferenceDefaultRPM:        7,
		IngressInferenceDefaultBurst:      3,
		IngressInferenceDefaultConcurrent: 4,
		IngressInferenceMaxRPM:            10,
		IngressInferenceGlobalRPM:         50,
		IngressInferenceGlobalConcurrent:  5,
		IngressWorkloadDefaultRPM:         600,
		IngressWorkloadDefaultConcurrent:  20,
		IngressWorkloadMaxRPM:             3000,
	}
	s := &Server{Cfg: cfg}

	rr := httptest.NewRecorder()
	s.handleGetIngressDefaults(rr, httptest.NewRequest(http.MethodGet, "/api/v1/ingress/defaults", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rr.Code)
	}

	var got ingressDefaultsResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Inference.RequestsPerMinute != 7 || got.Inference.BurstRequests != 3 ||
		got.Inference.MaxConcurrentRequests != 4 || got.Inference.MaxRequestsPerMinute != 10 {
		t.Fatalf("unexpected inference defaults: %+v", got.Inference)
	}
	if got.Inference.GlobalRequestsPerMinute != 50 || got.Inference.GlobalMaxConcurrentRequests != 5 {
		t.Fatalf("unexpected inference globals: %+v", got.Inference)
	}
	if got.Workload.RequestsPerMinute != 600 || got.Workload.MaxRequestsPerMinute != 3000 {
		t.Fatalf("unexpected workload defaults: %+v", got.Workload)
	}
	// No configured burst: derived from RPM (600 -> shared 100 cap).
	if got.Workload.BurstRequests != 100 {
		t.Fatalf("workload burst = %d, want 100", got.Workload.BurstRequests)
	}
}

func TestGetIngressDefaultsClampsBurstToRPM(t *testing.T) {
	cfg := &config.Config{
		IngressInferenceDefaultRPM:   5,
		IngressInferenceDefaultBurst: 100,
	}
	s := &Server{Cfg: cfg}

	rr := httptest.NewRecorder()
	s.handleGetIngressDefaults(rr, httptest.NewRequest(http.MethodGet, "/api/v1/ingress/defaults", nil))

	var got ingressDefaultsResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Inference.BurstRequests != 5 {
		t.Fatalf("burst = %d, want clamped 5", got.Inference.BurstRequests)
	}
}
