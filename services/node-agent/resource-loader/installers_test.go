package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"orcn/services/node-agent/resources"
)

func TestInstallFile(t *testing.T) {
	tmpDir := t.TempDir()
	dest := filepath.Join(tmpDir, "test-file.txt")

	resource := resources.Resource{
		ID:          "test-file",
		Type:        "file",
		Config:      map[string]any{"content": "hello world", "permissions": "0644"},
		Destination: dest,
	}

	err := installFile(context.Background(), resource, nil)
	if err != nil {
		t.Fatalf("installFile failed: %v", err)
	}

	content, err := os.ReadFile(dest)
	if err != nil {
		t.Fatalf("read file: %v", err)
	}

	if string(content) != "hello world" {
		t.Fatalf("unexpected content: %q", string(content))
	}

	info, err := os.Stat(dest)
	if err != nil {
		t.Fatalf("stat file: %v", err)
	}

	if info.Mode().Perm() != 0644 {
		t.Fatalf("unexpected permissions: %o", info.Mode().Perm())
	}
}

func TestInstallFileMissingContent(t *testing.T) {
	tmpDir := t.TempDir()
	dest := filepath.Join(tmpDir, "test-file.txt")

	resource := resources.Resource{
		ID:          "test-file",
		Type:        "file",
		Config:      map[string]any{},
		Destination: dest,
	}

	err := installFile(context.Background(), resource, nil)
	if err == nil {
		t.Fatal("expected error for missing content")
	}

	if !strings.Contains(err.Error(), "content") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestInstallHTTPInvalidURL(t *testing.T) {
	tmpDir := t.TempDir()
	dest := filepath.Join(tmpDir, "test.bin")

	resource := resources.Resource{
		ID:          "test-http",
		Type:        "http",
		Config:      map[string]any{"url": "not-a-valid-url"},
		Destination: dest,
	}

	err := installHTTP(context.Background(), resource, nil)
	if err == nil {
		t.Fatal("expected error for invalid URL")
	}

	if !strings.Contains(err.Error(), "invalid") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestInstallHTTPMissingURL(t *testing.T) {
	tmpDir := t.TempDir()
	dest := filepath.Join(tmpDir, "test.bin")

	resource := resources.Resource{
		ID:          "test-http",
		Type:        "http",
		Config:      map[string]any{},
		Destination: dest,
	}

	err := installHTTP(context.Background(), resource, nil)
	if err == nil {
		t.Fatal("expected error for missing URL")
	}

	if !strings.Contains(err.Error(), "requires config.url") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestInstallGitInvalidURL(t *testing.T) {
	tmpDir := t.TempDir()
	dest := filepath.Join(tmpDir, "repo")

	resource := resources.Resource{
		ID:          "test-git",
		Type:        "git",
		Config:      map[string]any{"url": "not-a-valid-url"},
		Destination: dest,
	}

	err := installGit(context.Background(), resource, nil)
	if err == nil {
		t.Fatal("expected error for invalid URL")
	}

	if !strings.Contains(err.Error(), "invalid git URL") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestInstallGitMissingURL(t *testing.T) {
	tmpDir := t.TempDir()
	dest := filepath.Join(tmpDir, "repo")

	resource := resources.Resource{
		ID:          "test-git",
		Type:        "git",
		Config:      map[string]any{},
		Destination: dest,
	}

	err := installGit(context.Background(), resource, nil)
	if err == nil {
		t.Fatal("expected error for missing URL")
	}

	if !strings.Contains(err.Error(), "requires config.url") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestInstallGitInvalidDestination(t *testing.T) {
	resource := resources.Resource{
		ID:          "test-git",
		Type:        "git",
		Config:      map[string]any{"url": "https://github.com/test/repo.git"},
		Destination: "/",
	}

	err := installGit(context.Background(), resource, nil)
	if err == nil {
		t.Fatal("expected error for invalid destination")
	}

	if !strings.Contains(err.Error(), "invalid destination") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestInstallGitSSHURLValidates(t *testing.T) {
	tmpDir := t.TempDir()
	dest := filepath.Join(tmpDir, "repo")

	resource := resources.Resource{
		ID:          "test-git",
		Type:        "git",
		Config:      map[string]any{"url": "git@github.com:test/repo.git"},
		Destination: dest,
	}

	err := installGit(context.Background(), resource, nil)
	if err == nil {
		t.Fatal("expected error for SSH URL (no auth setup)")
	}

	if !strings.Contains(err.Error(), "invalid git URL") {
		t.Fatalf("unexpected error for SSH URL: %v", err)
	}
}

func TestInstallHFMissingURL(t *testing.T) {
	t.Skip("HF installer not yet implemented")
}

func TestInstallS3MissingConfig(t *testing.T) {
	tmpDir := t.TempDir()
	dest := filepath.Join(tmpDir, "s3-data")

	resource := resources.Resource{
		ID:          "test-s3",
		Type:        "s3",
		Config:      map[string]any{},
		Destination: dest,
	}

	err := installS3(context.Background(), resource, nil)
	if err == nil {
		t.Fatal("expected error for missing S3 config")
	}

	if !strings.Contains(err.Error(), "not yet implemented") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestProgressCallbackCalled(t *testing.T) {
	tmpDir := t.TempDir()
	dest := filepath.Join(tmpDir, "test-file.txt")

	progressCalled := false
	var lastDone, lastTotal int64

	resource := resources.Resource{
		ID:          "test-file",
		Type:        "file",
		Config:      map[string]any{"content": "hello world"},
		Destination: dest,
	}

	err := installFile(context.Background(), resource, func(done, total int64) {
		progressCalled = true
		lastDone = done
		lastTotal = total
	})
	if err != nil {
		t.Fatalf("installFile failed: %v", err)
	}

	if !progressCalled {
		t.Fatal("progress callback was not called")
	}

	if lastDone != 11 || lastTotal != 11 {
		t.Fatalf("unexpected progress values: done=%d total=%d", lastDone, lastTotal)
	}
}

func TestInstallGitBranchOption(t *testing.T) {
	tmpDir := t.TempDir()
	dest := filepath.Join(tmpDir, "repo")

	resource := resources.Resource{
		ID:          "test-git",
		Type:        "git",
		Config: map[string]any{
			"url":      "https://github.com/test/repo.git",
			"revision": "develop",
		},
		Destination: dest,
	}

	err := installGit(context.Background(), resource, nil)
	if err == nil {
		t.Fatal("expected error for non-existent repo")
	}

	if strings.Contains(err.Error(), "Repository not found") || strings.Contains(err.Error(), "could not find remote reference") || strings.Contains(err.Error(), "authentication required") {
		t.Logf("Got expected error for non-existent repo: %v", err)
	} else {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestResourceTypeCoverage(t *testing.T) {
	registry := newInstallerRegistry()

	if err := registry.Register("http", installHTTP); err != nil {
		t.Fatalf("register HTTP: %v", err)
	}
	if err := registry.Register("https", installHTTP); err != nil {
		t.Fatalf("register HTTPS: %v", err)
	}
	if err := registry.Register("hf", installHF); err != nil {
		t.Fatalf("register HF: %v", err)
	}
	if err := registry.Register("file", installFile); err != nil {
		t.Fatalf("register file: %v", err)
	}
	if err := registry.Register("git", installGit); err != nil {
		t.Fatalf("register git: %v", err)
	}
	if err := registry.Register("s3", installS3); err != nil {
		t.Fatalf("register s3: %v", err)
	}

	for _, provider := range []string{"http", "https", "hf", "file", "git", "s3"} {
		_, ok := registry.installers[provider]
		if !ok {
			t.Errorf("no installer registered for resource type %q", provider)
		}
	}
}

func TestInstallGitTokenConfig(t *testing.T) {
	tmpDir := t.TempDir()
	dest := filepath.Join(tmpDir, "repo")

	resource := resources.Resource{
		ID:          "test-git",
		Type:        "git",
		Config: map[string]any{
			"url":   "https://github.com/test/repo.git",
			"token": "ghp_fake_token_for_testing",
		},
		Destination: dest,
	}

	err := installGit(context.Background(), resource, nil)
	if err == nil {
		t.Fatal("expected error for non-existent repo")
	}

	if strings.Contains(err.Error(), "authentication") || strings.Contains(err.Error(), "credential") {
		t.Log("Token was passed to git (auth error expected)")
	} else if strings.Contains(err.Error(), "clone git resource") || strings.Contains(err.Error(), "reference not found") {
		t.Log("Got expected clone error")
	} else {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestInstallHTTPProgress(t *testing.T) {
	tmpDir := t.TempDir()
	dest := filepath.Join(tmpDir, "test.bin")

	resource := resources.Resource{
		ID:          "test-http",
		Type:        "http",
		Config:      map[string]any{"url": "https://example.com/test.bin"},
		Destination: dest,
	}

	progressCalled := false
	err := installHTTP(context.Background(), resource, func(done, total int64) {
		progressCalled = true
	})

	if err == nil {
		t.Fatal("expected error for non-existent URL")
	}

	if progressCalled {
		t.Log("Progress callback was called (expected for failed download)")
	}
}

func TestInstallHFInvalidURL(t *testing.T) {
	t.Skip("HF installer not yet implemented")
}

func TestInstallFilePermissions(t *testing.T) {
	tmpDir := t.TempDir()

	tests := []struct {
		name      string
		permStr   string
		expectPerm os.FileMode
	}{
		{"default", "", 0644},
		{"0644", "0644", 0644},
		{"0755", "0755", 0755},
		{"0600", "0600", 0600},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dest := filepath.Join(tmpDir, fmt.Sprintf("test-%s.txt", tt.name))

			config := map[string]any{"content": "test"}
			if tt.permStr != "" {
				config["permissions"] = tt.permStr
			}

			resource := resources.Resource{
				ID:          "test-file",
				Type:        "file",
				Config:      config,
				Destination: dest,
			}

			err := installFile(context.Background(), resource, nil)
			if err != nil {
				t.Fatalf("installFile failed: %v", err)
			}

			info, err := os.Stat(dest)
			if err != nil {
				t.Fatalf("stat file: %v", err)
			}

			if info.Mode().Perm() != tt.expectPerm {
				t.Fatalf("unexpected permissions: got %o, want %o", info.Mode().Perm(), tt.expectPerm)
			}
		})
	}
}