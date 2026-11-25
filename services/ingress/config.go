package ingress

import (
	"time"

	appconfig "orcn/core/config"
)

type Config struct {
	AppDomain string

	SyncInterval     time.Duration
	RouteStaleAfter  time.Duration
	InternalAPIToken string
	MaxConnsPerHost  int

	// Ingress policy defaults and ceilings, sourced from .env via app config.
	// Kind is either "model_inference" or "workload".
	InferenceDefaultRPM        int
	InferenceDefaultBurst      int
	InferenceDefaultConcurrent int
	InferenceMaxRPM            int
	InferenceGlobalRPM         int
	InferenceGlobalConcurrent  int

	WorkloadDefaultRPM        int
	WorkloadDefaultBurst      int
	WorkloadDefaultConcurrent int
	WorkloadMaxRPM            int
	WorkloadGlobalRPM         int
	WorkloadGlobalConcurrent  int
}

func ConfigFromAppConfig(cfg *appconfig.Config) Config {
	return Config{
		AppDomain:        cfg.AppDomain,
		SyncInterval:     time.Duration(cfg.GatewaySyncIntervalSec) * time.Second,
		RouteStaleAfter:  time.Duration(300) * time.Second,
		InternalAPIToken: cfg.InternalAPIToken,
		MaxConnsPerHost:  cfg.MaxConnsPerHost,

		InferenceDefaultRPM:        cfg.IngressInferenceDefaultRPM,
		InferenceDefaultBurst:      cfg.IngressInferenceDefaultBurst,
		InferenceDefaultConcurrent: cfg.IngressInferenceDefaultConcurrent,
		InferenceMaxRPM:            cfg.IngressInferenceMaxRPM,
		InferenceGlobalRPM:         cfg.IngressInferenceGlobalRPM,
		InferenceGlobalConcurrent:  cfg.IngressInferenceGlobalConcurrent,

		WorkloadDefaultRPM:        cfg.IngressWorkloadDefaultRPM,
		WorkloadDefaultBurst:      cfg.IngressWorkloadDefaultBurst,
		WorkloadDefaultConcurrent: cfg.IngressWorkloadDefaultConcurrent,
		WorkloadMaxRPM:            cfg.IngressWorkloadMaxRPM,
		WorkloadGlobalRPM:         cfg.IngressWorkloadGlobalRPM,
		WorkloadGlobalConcurrent:  cfg.IngressWorkloadGlobalConcurrent,
	}
}
