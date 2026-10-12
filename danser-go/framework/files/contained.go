package files

import (
	"os"
	"path/filepath"
)

// OpenContained follows case-resolved resource names but never a link outside root.
// Go's Root.Open enforces containment during traversal, including rename races.
func OpenContained(directory, filename string) (*os.File, error) {
	relative, err := filepath.Rel(directory, filename)
	if err != nil {
		return nil, err
	}
	root, err := os.OpenRoot(directory)
	if err != nil {
		return nil, err
	}
	defer root.Close()
	file, err := root.Open(relative)
	if err != nil {
		return nil, err
	}
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() {
		file.Close()
		if err != nil {
			return nil, err
		}
		return nil, os.ErrPermission
	}
	return file, nil
}
