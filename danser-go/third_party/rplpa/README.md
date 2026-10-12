# Bounded replay decoder

Source fork of [Wieku/rplpa v1.0.2](https://github.com/Wieku/rplpa/tree/v1.0.2), used through the parent module's `replace` directive. The original MIT license is retained.

Studio changes: 20 MiB input/slice cap, bounded string lengths, exact reads, rejection of negative lengths, 16 MiB LZMA dictionaries, actual output caps (64 MiB frames / 4 MiB metadata, including unknown-length streams), and two million frames. Public types and encoding APIs are unchanged. Keep this fork in sync when updating upstream.
