package rplpa

import (
	"bytes"
	"encoding/binary"
	"testing"

	"github.com/itchio/lzma"
)

func TestDecodeBudget(t *testing.T) {
	var compressed bytes.Buffer
	w := lzma.NewWriter(&compressed)
	if _, err := w.Write([]byte("bounded fixture")); err != nil {
		t.Fatal(err)
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	data := compressed.Bytes()
	if decoded, err := decodeBounded(data, 64); err != nil || string(decoded) != "bounded fixture" {
		t.Fatalf("positive: %q %v", decoded, err)
	}
	unknown := append([]byte(nil), data...)
	for i := 5; i < 13; i++ {
		unknown[i] = 255
	}
	if _, err := decodeBounded(unknown, 4); err == nil {
		t.Fatal("unknown-sized output exceeded budget")
	}
	binary.LittleEndian.PutUint32(unknown[1:5], 0x7fffffff)
	if _, err := decodeBounded(unknown, 64); err == nil {
		t.Fatal("dictionary exceeded budget")
	}
	if _, err := rSlice(bytes.NewReader(nil), -1); err == nil {
		t.Fatal("negative allocation accepted")
	}
}
