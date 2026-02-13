package grizzly

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadConfigPrecedence(t *testing.T) {
	root := t.TempDir()
	userConfigDir := filepath.Join(root, "user")
	projectDir := filepath.Join(root, "project")
	if err := os.MkdirAll(userConfigDir, 0755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	userConfig := filepath.Join(userConfigDir, "grizzly", "config.toml")
	if err := os.MkdirAll(filepath.Dir(userConfig), 0755); err != nil {
		t.Fatalf("mkdir user config dir: %v", err)
	}
	if err := os.WriteFile(userConfig, []byte("token_file = \"user\"\ncallback_url = \"http://user\"\ntimeout = \"1s\"\n"), 0644); err != nil {
		t.Fatalf("write user config: %v", err)
	}

	projectConfig := filepath.Join(projectDir, ".grizzly.toml")
	if err := os.WriteFile(projectConfig, []byte("token_file = \"project\"\ncallback_url = \"http://project\"\ntimeout = \"2s\"\n"), 0644); err != nil {
		t.Fatalf("write project config: %v", err)
	}

	oldWd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	if err := os.Chdir(projectDir); err != nil {
		t.Fatalf("chdir: %v", err)
	}
	defer func() {
		_ = os.Chdir(oldWd)
	}()

	t.Setenv("XDG_CONFIG_HOME", userConfigDir)
	t.Setenv("GRIZZLY_TOKEN_FILE", "env")
	t.Setenv("GRIZZLY_CALLBACK_URL", "http://env")
	t.Setenv("GRIZZLY_TIMEOUT", "3s")

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	if cfg.TokenFile != "env" {
		t.Fatalf("TokenFile = %q", cfg.TokenFile)
	}
	if cfg.CallbackURL != "http://env" {
		t.Fatalf("CallbackURL = %q", cfg.CallbackURL)
	}
	if cfg.Timeout != 3*time.Second || !cfg.TimeoutSet {
		t.Fatalf("Timeout = %v, TimeoutSet = %v", cfg.Timeout, cfg.TimeoutSet)
	}
}

func TestLoadConfigTimeoutZero(t *testing.T) {
	root := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", root)
	t.Setenv("GRIZZLY_TIMEOUT", "0s")

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	if cfg.Timeout != 0 || !cfg.TimeoutSet {
		t.Fatalf("Timeout = %v, TimeoutSet = %v", cfg.Timeout, cfg.TimeoutSet)
	}
}
