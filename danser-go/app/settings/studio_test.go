package settings

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestStudioManifest(t *testing.T) {
	path := filepath.Join(t.TempDir(), "manifest.json")
	hash := strings.Repeat("a", 64)
	data := `{"Version":1,"Replays":[{"Path":"replay.osr","SHA256":"` + hash + `","Color":"#ff8000"}]}`
	if err := os.WriteFile(path, []byte(data), 0600); err != nil {
		t.Fatal(err)
	}
	paths, err := LoadStudioManifest(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(paths) != 1 || paths[0] != "replay.osr" {
		t.Fatal(paths)
	}
	c := StudioReplayColors[hash]
	if c.R != 1 || c.G < 0.50 || c.G > 0.51 || c.B != 0 {
		t.Fatal(c)
	}
	if err := os.WriteFile(path, []byte(`{"Version":2,"Replays":[]}`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadStudioManifest(path); err == nil {
		t.Fatal("unsupported manifest was accepted")
	}
	if StudioReplayColors[hash] != c {
		t.Fatal("a failed load changed the palette")
	}
}
