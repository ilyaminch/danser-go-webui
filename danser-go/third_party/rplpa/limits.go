package rplpa

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"

	"github.com/itchio/lzma"
)

// The actual output cap also applies to streams with an unknown/lying size.
func decodeBounded(data []byte, limit int64) ([]byte, error) {
	if len(data) < 13 || len(data) > 20*1024*1024 {
		return nil, fmt.Errorf("invalid LZMA input length")
	}
	if binary.LittleEndian.Uint32(data[1:5]) > 16*1024*1024 {
		return nil, fmt.Errorf("LZMA dictionary exceeds 16 MiB")
	}
	size := binary.LittleEndian.Uint64(data[5:13])
	if size != ^uint64(0) && size > uint64(limit) {
		return nil, fmt.Errorf("decoded LZMA data exceeds budget")
	}
	r := lzma.NewReader(bytes.NewReader(data))
	defer r.Close()
	decoded, err := io.ReadAll(io.LimitReader(r, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(decoded)) > limit {
		return nil, fmt.Errorf("decoded LZMA data exceeds budget")
	}
	return decoded, nil
}
