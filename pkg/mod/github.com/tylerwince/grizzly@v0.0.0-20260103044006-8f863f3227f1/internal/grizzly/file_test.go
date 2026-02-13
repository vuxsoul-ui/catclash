package grizzly

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"testing"
)

func TestLoadFileParam_File(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "example.txt")
	data := []byte("hello")
	if err := os.WriteFile(path, data, 0644); err != nil {
		t.Fatalf("write file: %v", err)
	}

	encoded, name, usedStdin, err := loadFileParam(path, "")
	if err != nil {
		t.Fatalf("loadFileParam: %v", err)
	}
	if usedStdin {
		t.Fatalf("usedStdin should be false")
	}
	if name != "example.txt" {
		t.Fatalf("filename = %q", name)
	}

	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatalf("decode base64: %v", err)
	}
	if string(decoded) != string(data) {
		t.Fatalf("decoded = %q", string(decoded))
	}
}

func TestLoadFileParam_StdinRequiresFilename(t *testing.T) {
	orig := os.Stdin
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe: %v", err)
	}
	os.Stdin = r
	defer func() {
		os.Stdin = orig
		_ = r.Close()
	}()

	if _, err := w.Write([]byte("hi")); err != nil {
		t.Fatalf("write pipe: %v", err)
	}
	_ = w.Close()

	_, _, _, err = loadFileParam("-", "")
	if err == nil {
		t.Fatalf("expected error when filename is missing")
	}
}

func TestLoadFileParam_StdinWithFilename(t *testing.T) {
	orig := os.Stdin
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe: %v", err)
	}
	os.Stdin = r
	defer func() {
		os.Stdin = orig
		_ = r.Close()
	}()

	if _, err := w.Write([]byte("data")); err != nil {
		t.Fatalf("write pipe: %v", err)
	}
	_ = w.Close()

	encoded, name, usedStdin, err := loadFileParam("-", "stdin.txt")
	if err != nil {
		t.Fatalf("loadFileParam: %v", err)
	}
	if !usedStdin {
		t.Fatalf("usedStdin should be true")
	}
	if name != "stdin.txt" {
		t.Fatalf("filename = %q", name)
	}

	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatalf("decode base64: %v", err)
	}
	if string(decoded) != "data" {
		t.Fatalf("decoded = %q", string(decoded))
	}
}
