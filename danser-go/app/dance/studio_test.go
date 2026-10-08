package dance

import (
	"github.com/wieku/danser-go/app/graphics"
	"github.com/wieku/danser-go/framework/math/color"
	"testing"
)

func TestStudioColorsKeepIdentityAndAlpha(t *testing.T) {
	controller := &ReplayController{cursors: make([]*graphics.Cursor, 2), studioCursorColors: map[int]color.Color{0: color.NewRGB(0, 1, 0), 1: color.NewRGB(1, 0, 0)}}
	colors := []color.Color{color.NewRGBA(0, 0, 1, .4), color.NewRGBA(0, 0, 1, .7), color.NewRGBA(0, 0, 1, .2), color.NewRGBA(0, 0, 1, .9)}
	controller.ApplyStudioColors(colors)
	if colors[0].G != 1 || colors[1].R != 1 || colors[2].G != 1 || colors[3].R != 1 {
		t.Fatal(colors)
	}
	if colors[0].A != .4 || colors[1].A != .7 || colors[2].A != .2 || colors[3].A != .9 {
		t.Fatal("fade alpha changed", colors)
	}
}
