package sglang

import (
	"fmt"
	"strconv"
	"strings"

	"orcn/core"
)

// validateAdvancedConfig rejects unknown options and values that SGLang would
// otherwise fail on at start-up. It intentionally stays small: the schema is
// the source of truth, this only enforces it.
func validateAdvancedConfig(config map[string]string, schema []core.ConfigOption) error {
	if len(schema) == 0 {
		return nil
	}

	var errs []string
	known := make(map[string]core.ConfigOption, len(schema))
	for _, option := range schema {
		known[option.Key] = option
	}

	for key := range config {
		if key == "image" {
			continue
		}
		if _, ok := known[key]; !ok {
			errs = append(errs, fmt.Sprintf("unknown option %q", key))
		}
	}

	for _, option := range schema {
		raw, ok := config[option.Key]
		if !ok {
			continue
		}
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		errs = append(errs, validateOption(option, raw)...)
	}

	errs = append(errs, validatePositiveIntegers(config)...)
	if len(errs) == 0 {
		return nil
	}
	return fmt.Errorf("invalid SGLang configuration: %s", strings.Join(errs, "; "))
}

func validateOption(option core.ConfigOption, raw string) []string {
	switch option.Type {
	case "number":
		value, err := strconv.ParseFloat(raw, 64)
		if err != nil {
			return []string{fmt.Sprintf("%s must be a number, got %q", option.Key, raw)}
		}
		var errs []string
		if option.Min != nil && value < *option.Min {
			errs = append(errs, fmt.Sprintf("%s must be at least %s", option.Key, formatBound(*option.Min)))
		}
		if option.Max != nil && value > *option.Max {
			errs = append(errs, fmt.Sprintf("%s must be at most %s", option.Key, formatBound(*option.Max)))
		}
		return errs
	case "boolean":
		if _, err := strconv.ParseBool(raw); err != nil {
			return []string{fmt.Sprintf("%s must be true or false, got %q", option.Key, raw)}
		}
		return nil
	case "select":
		for _, allowed := range option.Options {
			if raw == allowed {
				return nil
			}
		}
		return []string{fmt.Sprintf("%s has unsupported value %q (allowed: %s)", option.Key, raw, strings.Join(option.Options, ", "))}
	default:
		return nil
	}
}

func validatePositiveIntegers(config map[string]string) []string {
	var errs []string
	for _, key := range []string{
		"context_length",
		"max_running_requests",
		"max_prefill_tokens",
		"chunked_prefill_size",
	} {
		raw, ok := config[key]
		if !ok {
			continue
		}
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		value, err := strconv.Atoi(raw)
		if err != nil {
			errs = append(errs, fmt.Sprintf("%s must be an integer, got %q", key, raw))
			continue
		}
		if value < 1 {
			errs = append(errs, fmt.Sprintf("%s must be at least 1, got %d", key, value))
		}
	}
	return errs
}

func formatBound(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}
