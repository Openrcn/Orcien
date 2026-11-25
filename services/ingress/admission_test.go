package ingress

import (
	"errors"
	"testing"
)

func testAdmissionConfig() Config {
	return Config{
		InferenceDefaultRPM:        120,
		InferenceDefaultBurst:      100,
		InferenceDefaultConcurrent: 32,
		InferenceMaxRPM:            1200,
		WorkloadDefaultRPM:         6000,
		WorkloadDefaultBurst:       100,
		WorkloadDefaultConcurrent:  500,
		WorkloadMaxRPM:             30000,
	}
}

func TestAdmissionIsAggregatePerRoute(t *testing.T) {
	c := NewAdmissionController(testAdmissionConfig())
	release, err := c.Acquire("llama.acme", "model_inference", AdmissionPolicy{MaxConcurrentRequests: 1})
	if err != nil {
		t.Fatal(err)
	}
	defer release()

	if _, err := c.Acquire("llama.acme", "model_inference", AdmissionPolicy{MaxConcurrentRequests: 1}); !errors.Is(err, ErrConcurrencyLimited) {
		t.Fatalf("got %v, want concurrency limit", err)
	}
	otherRelease, err := c.Acquire("embeddings.acme", "model_inference", AdmissionPolicy{MaxConcurrentRequests: 1})
	if err != nil {
		t.Fatalf("a different deployment must have its own budget: %v", err)
	}
	otherRelease()
}

func TestAdmissionRateLimit(t *testing.T) {
	c := NewAdmissionController(testAdmissionConfig())
	release, err := c.Acquire("llama.acme", "model_inference", AdmissionPolicy{RequestsPerMinute: 1, BurstRequests: 1})
	if err != nil {
		t.Fatal(err)
	}
	release()
	if _, err := c.Acquire("llama.acme", "model_inference", AdmissionPolicy{RequestsPerMinute: 1, BurstRequests: 1}); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("got %v, want rate limit", err)
	}
}

func TestAdmissionOptionalGlobalLimit(t *testing.T) {
	cfg := testAdmissionConfig()
	c := NewAdmissionController(cfg)
	release, err := c.Acquire("ui.acme", "workload", AdmissionPolicy{RequestsPerMinute: 100, BurstRequests: 100})
	if err != nil {
		t.Fatal(err)
	}
	release()
	if _, err := c.Acquire("docs.acme", "workload", AdmissionPolicy{RequestsPerMinute: 100, BurstRequests: 100}); err != nil {
		t.Fatalf("got %v, want nil global limit", err)
	}
}

func TestEffectivePolicyUsesConfiguredDefaults(t *testing.T) {
	cfg := testAdmissionConfig()
	cfg.InferenceDefaultRPM = 7
	cfg.InferenceDefaultBurst = 3
	cfg.InferenceDefaultConcurrent = 4
	cfg.InferenceMaxRPM = 10
	c := NewAdmissionController(cfg)

	got := c.effectivePolicy("model_inference", AdmissionPolicy{})
	want := AdmissionPolicy{RequestsPerMinute: 7, BurstRequests: 3, MaxConcurrentRequests: 4}
	if got != want {
		t.Fatalf("got %+v, want %+v", got, want)
	}
}

func TestEffectivePolicyCapsAtConfiguredMax(t *testing.T) {
	cfg := testAdmissionConfig()
	cfg.InferenceDefaultRPM = 7
	cfg.InferenceMaxRPM = 10
	c := NewAdmissionController(cfg)

	got := c.effectivePolicy("model_inference", AdmissionPolicy{RequestsPerMinute: 999})
	if got.RequestsPerMinute != 10 {
		t.Fatalf("got RPM %d, want configured max 10", got.RequestsPerMinute)
	}
}

func TestGlobalPolicyUsesConfiguredValues(t *testing.T) {
	cfg := testAdmissionConfig()
	cfg.InferenceGlobalRPM = 50
	cfg.InferenceGlobalConcurrent = 5
	cfg.WorkloadGlobalRPM = 500
	cfg.WorkloadGlobalConcurrent = 25
	c := NewAdmissionController(cfg)

	if rpm, concurrent := c.globalPolicy("model_inference"); rpm != 50 || concurrent != 5 {
		t.Fatalf("inference globals = %d/%d, want 50/5", rpm, concurrent)
	}
	if rpm, concurrent := c.globalPolicy("workload"); rpm != 500 || concurrent != 25 {
		t.Fatalf("workload globals = %d/%d, want 500/25", rpm, concurrent)
	}
}
