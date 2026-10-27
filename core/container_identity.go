package core

import (
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"strings"
)

func randomSuffix() (string, error) {
	buf := make([]byte, 2)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return fmt.Sprintf("%04d", binary.BigEndian.Uint16(buf)%10000), nil
}

func SanitizeContainerName(name string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(strings.TrimSpace(name)) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '-', r == '.', r == '_':
			b.WriteRune(r)
		default:
			b.WriteRune('-')
		}
	}
	cleaned := strings.Trim(b.String(), "-_")
	if cleaned == "" {
		cleaned = "container"
	}
	// Docker requires the first character to be alphanumeric.
	if cleaned[0] < 'a' || cleaned[0] > 'z' {
		if cleaned[0] < '0' || cleaned[0] > '9' {
			cleaned = "c" + cleaned
		}
	}
	return cleaned
}

// uniquify returns name unchanged if it has not been seen yet, otherwise the
// name with the smallest numeric suffix that makes it unique.
func uniquify(name string, seen map[string]bool) string {
	if !seen[name] {
		return name
	}
	for i := 2; ; i++ {
		candidate := fmt.Sprintf("%s-%d", name, i)
		if !seen[candidate] {
			return candidate
		}
	}
}


func AssignContainerIDs(spec *JobSpec) error {
	jobName := SanitizeContainerName(spec.JobName)
	for i := range spec.Containers {
		name := spec.Containers[i].Name
		if strings.TrimSpace(name) == "" {
			name = spec.Containers[i].ID
		}
		spec.Containers[i].Name = SanitizeContainerName(name)
	}

	seenNames := make(map[string]bool, len(spec.Containers))
	seenIDs := make(map[string]bool, len(spec.Containers))
	for i := range spec.Containers {
		name := uniquify(spec.Containers[i].Name, seenNames)
		seenNames[name] = true
		spec.Containers[i].Name = name

		suffix, err := randomSuffix()
		if err != nil {
			return fmt.Errorf("generate container id suffix: %w", err)
		}
		id := fmt.Sprintf("orcn.%s.%s.%s", jobName, name, suffix)
		for seenIDs[id] {
			s, err := randomSuffix()
			if err != nil {
				return fmt.Errorf("generate container id suffix: %w", err)
			}
			suffix = s
			id = fmt.Sprintf("orcn.%s.%s.%s", jobName, name, suffix)
		}
		seenIDs[id] = true
		spec.Containers[i].ID = id
	}
	return nil
}
