package ingress

import (
	"errors"
	"sync"
	"time"

	appconfig "orcn/core/config"
)

var (
	ErrRateLimited        = errors.New("request rate limit exceeded")
	ErrConcurrencyLimited = errors.New("request concurrency limit exceeded")
)

// AdmissionPolicy is the aggregate budget for a public deployment route.
type AdmissionPolicy struct {
	RequestsPerMinute     int
	BurstRequests         int
	MaxConcurrentRequests int
}

type tokenBucket struct {
	rpm    int
	burst  int
	tokens float64
	last   time.Time
}

func (b *tokenBucket) allow(now time.Time, rpm, burst int) bool {
	if rpm <= 0 {
		return true
	}
	if burst <= 0 {
		burst = defaultBurst(rpm)
	}
	if b.rpm != rpm || b.burst != burst {
		b.rpm, b.burst, b.tokens, b.last = rpm, burst, float64(burst), now
	}
	elapsed := now.Sub(b.last).Seconds()
	if elapsed > 0 {
		b.tokens = minFloat(float64(b.burst), b.tokens+elapsed*float64(b.rpm)/60)
		b.last = now
	}
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

func defaultBurst(rpm int) int {
	return appconfig.DefaultBurst(rpm)
}

func minFloat(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

type routeAdmission struct {
	bucket tokenBucket
	active int
}

type AdmissionController struct {
	mu      sync.Mutex
	cfg     Config
	routes  map[string]*routeAdmission
	globals map[string]*routeAdmission
}

func NewAdmissionController(cfg Config) *AdmissionController {
	return &AdmissionController{
		cfg:     cfg,
		routes:  make(map[string]*routeAdmission),
		globals: make(map[string]*routeAdmission),
	}
}

func (c *AdmissionController) Acquire(routeKey, kind string, requested AdmissionPolicy) (func(), error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	policy := c.effectivePolicy(kind, requested)
	route := c.routes[routeKey]
	if route == nil {
		route = &routeAdmission{}
		c.routes[routeKey] = route
	}
	global := c.globals[kind]
	if global == nil {
		global = &routeAdmission{}
		c.globals[kind] = global
	}
	globalRPM, globalConcurrent := c.globalPolicy(kind)

	if !canAllow(&route.bucket, now, policy.RequestsPerMinute, policy.BurstRequests) ||
		!canAllow(&global.bucket, now, globalRPM, 0) {
		return nil, ErrRateLimited
	}
	if exceeds(route.active, policy.MaxConcurrentRequests) || exceeds(global.active, globalConcurrent) {
		return nil, ErrConcurrencyLimited
	}

	consume(&route.bucket, now, policy.RequestsPerMinute, policy.BurstRequests)
	consume(&global.bucket, now, globalRPM, 0)
	route.active++
	global.active++

	return func() {
		c.mu.Lock()
		defer c.mu.Unlock()
		if route.active > 0 {
			route.active--
		}
		if global.active > 0 {
			global.active--
		}
	}, nil
}

func canAllow(bucket *tokenBucket, now time.Time, rpm, burst int) bool {
	copy := *bucket
	return copy.allow(now, rpm, burst)
}

func consume(bucket *tokenBucket, now time.Time, rpm, burst int) {
	_ = bucket.allow(now, rpm, burst)
}

func exceeds(active, limit int) bool { return limit > 0 && active >= limit }

func (c *AdmissionController) policyDefaults(kind string) (rpm, burst, concurrent, maxRPM int) {
	if kind == "workload" {
		return c.cfg.WorkloadDefaultRPM, c.cfg.WorkloadDefaultBurst,
			c.cfg.WorkloadDefaultConcurrent, c.cfg.WorkloadMaxRPM
	}
	return c.cfg.InferenceDefaultRPM, c.cfg.InferenceDefaultBurst,
		c.cfg.InferenceDefaultConcurrent, c.cfg.InferenceMaxRPM
}

func (c *AdmissionController) effectivePolicy(kind string, requested AdmissionPolicy) AdmissionPolicy {
	defaultRPM, defaultBurst, defaultConcurrent, maxRPM := c.policyDefaults(kind)
	if requested.RequestsPerMinute == 0 {
		requested.RequestsPerMinute = defaultRPM
	}
	if maxRPM > 0 && requested.RequestsPerMinute > maxRPM {
		requested.RequestsPerMinute = maxRPM
	}
	if requested.BurstRequests == 0 {
		if defaultBurst <= 0 {
			defaultBurst = appconfig.DefaultBurst(requested.RequestsPerMinute)
		}
		requested.BurstRequests = minInt(defaultBurst, requested.RequestsPerMinute)
	}
	if requested.MaxConcurrentRequests == 0 {
		requested.MaxConcurrentRequests = defaultConcurrent
	}
	return requested
}

func (c *AdmissionController) globalPolicy(kind string) (int, int) {
	if kind == "workload" {
		return c.cfg.WorkloadGlobalRPM, c.cfg.WorkloadGlobalConcurrent
	}
	return c.cfg.InferenceGlobalRPM, c.cfg.InferenceGlobalConcurrent
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}