package texture

import (
	"bytes"
	"image"
	"image/png"
	"sync/atomic"
	"testing"
)

func TestImageBudget(t *testing.T) {
	if size, err := imageSize(3840, 2160, 4); err != nil || size != 3840*2160*4 {
		t.Fatal(size, err)
	}
	for _, dimensions := range [][2]int{{0, 1}, {8193, 1}, {8192, 8192}} {
		if _, err := imageSize(dimensions[0], dimensions[1], 4); err == nil {
			t.Fatal("oversized image accepted", dimensions)
		}
	}
	var used atomic.Int64
	if !reserveBytes(&used, 8, 10) || reserveBytes(&used, 3, 10) {
		t.Fatal("aggregate cap not enforced")
	}
	used.Add(-8)
	if !reserveBytes(&used, 10, 10) {
		t.Fatal("released budget not reusable")
	}
	if textureSize(1, 4, 4, 4, 3) != 84 {
		t.Fatal("mipmap accounting")
	}
}

func TestDecodeImageBudget(t *testing.T) {
	var input bytes.Buffer
	if err := png.Encode(&input, image.NewRGBA(image.Rect(0, 0, 2, 2))); err != nil {
		t.Fatal(err)
	}
	before := pixmapBytes.Load()
	pixmap, err := NewPixmapFromBytes(input.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if pixmap.Width != 2 || pixmap.Height != 2 {
		t.Fatal("dimensions")
	}
	pixmap.Dispose()
	if pixmapBytes.Load() != before {
		t.Fatal("decoded budget not released")
	}
	input.Reset()
	if err := png.Encode(&input, image.NewRGBA(image.Rect(0, 0, 8193, 1))); err != nil {
		t.Fatal(err)
	}
	if pixmap, err := NewPixmapFromBytes(input.Bytes()); err == nil {
		pixmap.Dispose()
		t.Fatal("oversized PNG accepted")
	}
}
