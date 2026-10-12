package files

import (
	"os"
	"path/filepath"
	"testing"
)

func TestContainedResource(t *testing.T) {
	base := t.TempDir()
	root := filepath.Join(base, "map")
	if err := os.Mkdir(root, 0700); err != nil {
		t.Fatal(err)
	}
	inside := filepath.Join(root, "background.png")
	outside := filepath.Join(base, "outside.png")
	for _, name := range []string{inside, outside} {
		if err := os.WriteFile(name, []byte("dummy"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	f, err := OpenContained(root, inside)
	if err != nil {
		t.Fatal(err)
	}
	f.Close()
	if f, err := OpenContained(root, outside); err == nil {
		f.Close()
		t.Fatal("outside path accepted")
	}
	if _, err := OpenContained(root, filepath.Join(root, "missing.png")); err == nil {
		t.Fatal("missing accepted")
	}
	link := filepath.Join(root, "link.png")
	if err := os.Symlink(outside, link); err != nil {
		t.Skipf("symlink unavailable: %v", err)
	}
	if f, err := OpenContained(root, link); err == nil {
		f.Close()
		t.Fatal("outside symlink accepted")
	}
}
