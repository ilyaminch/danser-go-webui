package texture

import (
	"errors"
	"sync/atomic"
)

const maxImageBytes = 64 * 1024 * 1024
const maxImagePixels = 16 * 1024 * 1024
const maxImageSide = 8192
const maxPixmapBytes = 256 * 1024 * 1024
const maxTextureBytes = 2 * 1024 * 1024 * 1024

var pixmapBytes atomic.Int64
var textureBytes atomic.Int64

func reserveBytes(used *atomic.Int64, size, limit int64) bool {
	for {
		current := used.Load()
		if size <= 0 || size > limit-current {
			return false
		}
		if used.CompareAndSwap(current, current+size) {
			return true
		}
	}
}

func imageSize(width, height, components int) (int64, error) {
	if width <= 0 || height <= 0 || width > maxImageSide || height > maxImageSide || components < 1 || components > 4 {
		return 0, errors.New("image dimensions exceed budget")
	}
	pixels := int64(width) * int64(height)
	if pixels > maxImagePixels {
		return 0, errors.New("image exceeds 16 megapixels")
	}
	return pixels * int64(components), nil
}

func textureSize(layers, width, height, pixelBytes, mipmaps int) int64 {
	if layers < 1 || layers > 2048 || width < 1 || height < 1 || width > 16384 || height > 16384 || pixelBytes < 1 || pixelBytes > 16 || mipmaps > 15 {
		panic("texture dimensions exceed budget")
	}
	var size int64
	for level := 0; level < max(1, mipmaps); level++ {
		size += int64(max(1, width>>level)) * int64(max(1, height>>level)) * int64(layers) * int64(pixelBytes)
	}
	return size
}
