# Changelog

## 0.4.1 — 2026-10-12

- Wait for active render cancellation before stopping the server, preserving the cancelled status and replay retry inputs across restart.
- Verify stop/restart against a real synthetic native render.

## 0.4.0 — 2026-10-12

- First portable Windows x64 release, including Node, Studio engine and self-contained lazer helper. Initial runtime/FFmpeg downloads use pinned SHA-256 checksums.
- Separate engine fork, pinned as a Git submodule; full corresponding source release assets accompany binaries.
- Searchable styled map picker, dedicated video viewer, unclipped focus indicators and themed scrollbars.
- Clear date-gradient state, compact attempt cards with hit counts, roomier attempt browsing and independent new renders.
- Animated scenario switching and action feedback; compact queue polling and improved narrow-screen controls.
- Map-directory background containment, anti-framing headers and bounded imports, replay/map parsing and native decoding/allocation.
- Fresh-session software encoding fallback when NVENC is unavailable; safe start/stop launchers.

Existing source checkouts must run `git submodule update --init --recursive`. Automatic GitHub source archives omit submodule contents; use the complete source release asset.

## 0.3.0

Frontend redesign and replay/map workflows with local map, skin and export configuration.
