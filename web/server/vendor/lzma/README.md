# Bounded LZMA decoder

Fork of `lzma@2.3.2/src/lzma-d.js` from the locked dependency, by Nathan Rugg (MIT, license alongside). The only decoder modification adds a per-call byte budget and checks it in `$write_0` before appending output. This bounds unknown-size streams while retaining compatibility with the existing decoder; Studio also checks dictionary size before calling it. The original package remains available for test fixture compression.
