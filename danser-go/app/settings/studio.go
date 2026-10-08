package settings

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"

	color2 "github.com/wieku/danser-go/framework/math/color"
)

// StudioManifestVersion is probed by the local web launcher before submitting jobs.
const StudioManifestVersion = 1

type StudioReplay struct {
	Path   string
	SHA256 string
	Color  string
}

type StudioManifest struct {
	Version int
	Replays []StudioReplay
}

// Colors are keyed by file contents, never by username or controller index.
var StudioReplayColors = map[string]color2.Color{}

func LoadStudioManifest(path string) ([]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var manifest StudioManifest
	if err = json.Unmarshal(data, &manifest); err != nil {
		return nil, err
	}
	if manifest.Version != StudioManifestVersion || len(manifest.Replays) == 0 {
		return nil, fmt.Errorf("unsupported or empty Studio replay manifest")
	}
	colors := map[string]color2.Color{}
	paths := make([]string, 0, len(manifest.Replays))
	for _, replay := range manifest.Replays {
		if replay.Path == "" || !regexp.MustCompile(`^[a-f0-9]{64}$`).MatchString(replay.SHA256) || !regexp.MustCompile(`^#[a-fA-F0-9]{6}$`).MatchString(replay.Color) {
			return nil, fmt.Errorf("invalid Studio replay entry")
		}
		var rgb uint32
		if _, err = fmt.Sscanf(replay.Color, "#%06x", &rgb); err != nil {
			return nil, err
		}
		colors[replay.SHA256] = color2.NewI(rgb)
		paths = append(paths, replay.Path)
	}
	StudioReplayColors = colors
	return paths, nil
}
