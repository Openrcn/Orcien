package assets

import (
	"embed"
	"os"
	"path/filepath"
)

//go:embed vllm_bootstrap.json ollama_bootstrap.json sglang_bootstrap.json
var embeddedFS embed.FS

// ReadFile loads a named asset from ./assets/<name> on disk when present
// (for live local edits), falling back to the embedded copy.
func ReadFile(name string) ([]byte, error) {
	if data, err := os.ReadFile(filepath.Join("assets", name)); err == nil {
		return data, nil
	}
	return embeddedFS.ReadFile(name)
}
