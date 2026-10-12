package texture

// #cgo LDFLAGS: -lm
// #define STB_IMAGE_IMPLEMENTATION
// #define STB_IMAGE_WRITE_IMPLEMENTATION
// #define STBI_FAILURE_USERMSG
// #define STBI_MAX_DIMENSIONS 8192
// #include "stb_image.h"
// #include "stb_image_write.h"
// #include <stdint.h>
import "C"
import (
	"errors"
	"image"
	"io"
	"io/ioutil"
	"os"
	"unsafe"
)

type Pixmap struct {
	RawPointer unsafe.Pointer
	Data       []uint8

	Width      int
	Height     int
	Components int

	disposed    bool
	budgetBytes int64
}

func NewPixMap(width, height int) *Pixmap {
	return NewPixMapC(width, height, 4)
}

func NewPixMapW(width, height int) *Pixmap {
	pixmap := NewPixMapC(width, height, 4)

	for i := 0; i < width*height; i++ {
		pixmap.Data[i*4] = 255
		pixmap.Data[i*4+1] = 255
		pixmap.Data[i*4+2] = 255
		pixmap.Data[i*4+3] = 0
	}

	return pixmap
}

func NewPixMapC(width, height, components int) *Pixmap {
	checkedSize, err := imageSize(width, height, components)
	if err != nil || !reserveBytes(&pixmapBytes, checkedSize, maxPixmapBytes) {
		panic("pixmap allocation exceeds budget")
	}
	pixmap := new(Pixmap)
	pixmap.budgetBytes = checkedSize
	pixmap.Width = width
	pixmap.Height = height
	pixmap.Components = components

	size := width * height * components

	pixmap.RawPointer = C.calloc(C.size_t(size), C.size_t(1))
	if pixmap.RawPointer == nil {
		pixmapBytes.Add(-checkedSize)
		panic("pixmap allocation failed")
	}
	pixmap.Data = unsafe.Slice((*uint8)(pixmap.RawPointer), size)

	return pixmap
}

func NewPixmapFile(file *os.File) (*Pixmap, error) {
	stat, err := file.Stat()
	if err != nil {
		return nil, err
	}

	if stat.Size() == 0 {
		return nil, errors.New("empty file")
	}

	return NewPixmapReader(file, stat.Size())
}

func NewPixmapReader(file io.ReadCloser, _size int64) (*Pixmap, error) {
	if _size <= 0 || _size > maxImageBytes {
		return nil, errors.New("compressed image exceeds 64 MiB")
	}
	filePointer := C.stbi__malloc(C.size_t(_size))
	if filePointer == nil {
		return nil, errors.New("image input allocation failed")
	}
	fileData := unsafe.Slice((*uint8)(filePointer), _size)

	defer C.free(filePointer)

	if _, err := io.ReadFull(file, fileData); err != nil {
		return nil, err
	}

	return NewPixmapFromBytes(fileData)
}

func NewPixmapFromBytes(bytes []byte) (*Pixmap, error) {
	if bytes == nil || len(bytes) == 0 {
		return nil, errors.New("empty bytes")
	}
	if len(bytes) > maxImageBytes {
		return nil, errors.New("compressed image exceeds 64 MiB")
	}

	var x, y, components C.int
	if C.stbi_info_from_memory((*C.stbi_uc)(&bytes[0]), C.int(len(bytes)), &x, &y, &components) == 0 {
		return nil, errors.New("invalid image header")
	}
	checkedSize, err := imageSize(int(x), int(y), 4)
	if err != nil {
		return nil, err
	}
	if !reserveBytes(&pixmapBytes, checkedSize, maxPixmapBytes) {
		return nil, errors.New("decoded images exceed 256 MiB")
	}
	data := C.stbi_load_from_memory((*C.stbi_uc)(&bytes[0]), C.int(len(bytes)), &x, &y, nil, 4)

	if data == nil {
		pixmapBytes.Add(-checkedSize)
		return nil, errors.New(C.GoString(C.stbi_failure_reason()))
	}

	pixmap := new(Pixmap)
	pixmap.budgetBytes = checkedSize
	pixmap.Width = int(x)
	pixmap.Height = int(y)
	pixmap.Components = 4

	actualSize, sizeErr := imageSize(int(x), int(y), 4)
	if sizeErr != nil || actualSize != checkedSize {
		C.stbi_image_free(unsafe.Pointer(data))
		pixmapBytes.Add(-checkedSize)
		return nil, errors.New("image dimensions changed during decode")
	}
	size := int(actualSize)

	pixmap.RawPointer = unsafe.Pointer(data)
	pixmap.Data = unsafe.Slice((*uint8)(pixmap.RawPointer), size)

	return pixmap, nil
}

func NewPixmapFileString(path string) (*Pixmap, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}

	defer file.Close()

	return NewPixmapFile(file)
}

func (pixmap *Pixmap) NRGBA() *image.NRGBA {
	if pixmap.Components < 4 {
		panic("Can't create NRGBA with RGB pixmap")
	}

	return &image.NRGBA{
		Pix:    pixmap.Data,
		Stride: 4 * pixmap.Width,
		Rect:   image.Rect(0, 0, pixmap.Width, pixmap.Height),
	}
}

func (pixmap *Pixmap) RGBA() *image.RGBA {
	if pixmap.Components < 4 {
		panic("Can't create RGBA with RGB pixmap")
	}

	return &image.RGBA{
		Pix:    pixmap.Data,
		Stride: 4 * pixmap.Width,
		Rect:   image.Rect(0, 0, pixmap.Width, pixmap.Height),
	}
}

func (pixmap *Pixmap) WritePng(destination string, flip bool) error {
	if flip {
		C.stbi_flip_vertically_on_write(1)
	} else {
		C.stbi_flip_vertically_on_write(0)
	}

	var length C.int
	memPointer := C.stbi_write_png_to_mem((*C.uchar)(&pixmap.Data[0]), 0, C.int(pixmap.Width), C.int(pixmap.Height), C.int(pixmap.Components), &length)

	actPointer := unsafe.Pointer(memPointer)

	data := unsafe.Slice((*byte)(actPointer), int(length))

	err := ioutil.WriteFile(destination, data, 0644)

	C.free(actPointer)

	return err
}

func (pixmap *Pixmap) Dispose() {
	if pixmap.disposed {
		return
	}

	C.stbi_image_free(pixmap.RawPointer)
	pixmapBytes.Add(-pixmap.budgetBytes)

	pixmap.disposed = true
}
