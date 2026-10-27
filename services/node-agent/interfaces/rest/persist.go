package rest

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"orcn/core"
	"orcn/core/logger"
)

// persistFile is the on-disk representation of the registration state. It
// allows the node-agent to re-adopt deployments after a restart instead of
// leaving orphaned docker containers with no spec.
type persistFile struct {
	Jobs map[string]core.JobSpec `json:"jobs"`
}

// EnablePersistence makes the state persist to path on every
// register/unregister. Failures to write are logged, never fatal: persistence
// is a recovery convenience, not a correctness requirement.
func (s *RegistrationState) EnablePersistence(path string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.persistPath = path
	s.persistLocked()
}

// LoadFromdisk reads previously persisted jobs and registers them. It is
// called at startup, before the state is exposed, so registration capacity
// checks behave as on a fresh boot.
func (s *RegistrationState) LoadFromDisk(path string) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("read registration state: %w", err)
	}
	var file persistFile
	if err := json.Unmarshal(raw, &file); err != nil {
		return fmt.Errorf("parse registration state %s: %w", path, err)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for name, job := range file.Jobs {
		if _, exists := s.jobs[name]; exists {
			continue
		}
		s.jobs[name] = job
	}
	return nil
}

// persistLocked writes the current jobs to disk. Callers must hold the write
// lock.
func (s *RegistrationState) persistLocked() {
	if s.persistPath == "" {
		return
	}
	if err := writeStateFile(s.persistPath, &persistFile{Jobs: s.jobs}); err != nil {
		logger.New("STATE").Error("Failed to persist registrations: %v", err)
	}
}

func writeStateFile(path string, file *persistFile) error {
	if dir := filepath.Dir(path); dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("create state directory: %w", err)
		}
	}
	raw, err := json.Marshal(file)
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
