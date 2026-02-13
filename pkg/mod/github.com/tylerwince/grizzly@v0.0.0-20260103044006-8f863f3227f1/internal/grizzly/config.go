package grizzly

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/viper"
)

func LoadConfig() (Config, error) {
	cfg := Config{}

	userPath, err := userConfigPath()
	if err != nil {
		return cfg, err
	}
	projectPath, err := projectConfigPath()
	if err != nil {
		return cfg, err
	}

	if fileCfg, err := readConfigFile(userPath); err != nil {
		return cfg, err
	} else {
		applyConfig(&cfg, fileCfg)
	}

	if fileCfg, err := readConfigFile(projectPath); err != nil {
		return cfg, err
	} else {
		applyConfig(&cfg, fileCfg)
	}

	if envCfg, err := readEnvConfig(); err != nil {
		return cfg, err
	} else {
		applyConfig(&cfg, envCfg)
	}

	return cfg, nil
}

func userConfigPath() (string, error) {
	if base := os.Getenv("XDG_CONFIG_HOME"); base != "" {
		return filepath.Join(base, "grizzly", "config.toml"), nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".config", "grizzly", "config.toml"), nil
}

func projectConfigPath() (string, error) {
	wd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	return filepath.Join(wd, ".grizzly.toml"), nil
}

func readConfigFile(path string) (Config, error) {
	cfg := Config{}
	if path == "" {
		return cfg, nil
	}
	if _, err := os.Stat(path); err != nil {
		if os.IsNotExist(err) {
			return cfg, nil
		}
		return cfg, err
	}

	v := viper.New()
	v.SetConfigFile(path)
	if err := v.ReadInConfig(); err != nil {
		return cfg, fmt.Errorf("read config %s: %w", path, err)
	}

	cfg.TokenFile = strings.TrimSpace(v.GetString("token_file"))
	cfg.CallbackURL = strings.TrimSpace(v.GetString("callback_url"))
	if v.IsSet("timeout") {
		raw := strings.TrimSpace(v.GetString("timeout"))
		if raw == "" {
			return cfg, fmt.Errorf("invalid timeout in %s: empty", path)
		}
		d, err := time.ParseDuration(raw)
		if err != nil {
			return cfg, fmt.Errorf("invalid timeout in %s: %w", path, err)
		}
		cfg.Timeout = d
		cfg.TimeoutSet = true
	}

	return cfg, nil
}

func readEnvConfig() (Config, error) {
	cfg := Config{}
	if val, ok := os.LookupEnv("GRIZZLY_TOKEN_FILE"); ok {
		cfg.TokenFile = strings.TrimSpace(val)
	}
	if val, ok := os.LookupEnv("GRIZZLY_CALLBACK_URL"); ok {
		cfg.CallbackURL = strings.TrimSpace(val)
	}
	if val, ok := os.LookupEnv("GRIZZLY_TIMEOUT"); ok {
		d, err := time.ParseDuration(strings.TrimSpace(val))
		if err != nil {
			return cfg, fmt.Errorf("invalid GRIZZLY_TIMEOUT: %w", err)
		}
		cfg.Timeout = d
		cfg.TimeoutSet = true
	}
	return cfg, nil
}

func applyConfig(dest *Config, src Config) {
	if src.TokenFile != "" {
		dest.TokenFile = src.TokenFile
	}
	if src.CallbackURL != "" {
		dest.CallbackURL = src.CallbackURL
	}
	if src.TimeoutSet {
		dest.Timeout = src.Timeout
		dest.TimeoutSet = true
	}
}
