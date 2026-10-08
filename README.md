# Danser Studio — danser-go Web UI

A local web interface for comparing osu!standard replays and rendering them into videos. Import attempts recorded on different dates, include friends' replays, assign cursor colors, and choose whether players remain visible or are eliminated.

Built on **[Wieku/danser-go](https://github.com/Wieku/danser-go)**. This is an unofficial companion project with a modified copy of the engine, not an official danser-go release. The vendored engine is based on upstream commit `2fc4c8931ff4446a411b0094d7d7b4ede82c61c4` and retains its original documentation and credits in [`danser-go/`](danser-go/README.md).

## Features

- Batch `.osr` import, duplicate detection, player/date filters, and replay groups.
- Arbitrary color gradients ordered by replay date, per-player gradients, player colors, and manual overrides. Colors remain attached to the same replay when the engine sorts players or eliminates them.
- All five native comparison modes: Combo Break, Max Combo, Replay Showcase, Vs Mode, and SS or Quit. Configure the minimum number of surviving players, initial grace period, revival, sorting, and the additional danser cursor.
- Local maps from osu!stable Songs folders or osu!lazer storage. Replay imports and selections resolve the exact map using its MD5 hash.
- One render workspace with colors, elimination, export, launch options, skin selection, and the complete engine settings editor. Render settings remain in the browser tab session; no saved projects are created.
- Local skin folders and `.osk` archives, plus manual `.osz` map import when the exact replay map is missing.
- Rendering queue, progress and logs, cancellation and retry, short video previews, PNG screenshots, and MP4/MKV export.
- Single replay, cursor dance, autoplay, classic knockout, and native interactive play scenarios.

The application currently has a **Russian-language interface**. Windows is the tested platform.

## Requirements

- Windows x64 with graphics drivers capable of running danser-go.
- Node.js **24 or newer** and npm.
- FFmpeg and ffprobe, available on PATH or configured using an absolute FFmpeg path.
- A Studio engine build and the supporting assets/native libraries from danser-go.
- Local `.osr` files and the exact matching maps/resources.

This repository contains source code. Generated executables, downloaded toolchains, dependencies, runtime files, and user data are excluded. A fresh clone needs the setup steps below; there is no installer yet.

## Build and run on Windows

1. Clone this repository and install/build the web application:

   ```powershell
   git clone https://github.com/ilyaminch/danser-go-webui.git
   cd danser-go-webui
   cd web
   npm ci
   npm run build
   cd ..
   ```

2. Download the Windows x64 **0.12.0** archive from the [original danser-go releases](https://github.com/Wieku/danser-go/releases/tag/0.12.0) and extract its contents into a `runtime` folder in the repository root. Preserve its assets, native libraries, credits, and directory structure. The Studio build below creates a separate `runtime/danser-studio.exe`.

3. Set up the portable engine build tools used by `Build-Engine.ps1`:

   - Extract Windows x64 **Go 1.26.1** from [go.dev](https://go.dev/dl/) so that `.tools/go/bin/go.exe` exists.
   - Extract an x64 **WinLibs GCC 16.2.0, POSIX, MSVCRT** toolchain from [WinLibs](https://winlibs.com/) so that `.tools/mingw64/bin/gcc.exe` exists. This is the toolchain tested by this project. The build script includes a workaround for its handling of paths containing spaces.
   - Run `./Build-Engine.ps1` from PowerShell. It builds the Studio CLI, copies the required pthread library, and runs the engine checks. For other toolchain locations, adapt the paths in this script.

4. To enable local lazer storage, install [.NET SDK 9 or newer](https://dotnet.microsoft.com/download) and run `./Build-LazerIndex.ps1`. It produces a self-contained Windows helper in `runtime/lazer-index`; users running that helper do not need a separate .NET runtime.

5. Open **`Start-Studio.cmd`**. It starts the local service and opens **http://127.0.0.1:3000**. If the service is already running, it opens the existing instance. Startup logs are written to `web/data/server.stdout.log` and `server.stderr.log`.

Alternatively, start the built service using `npm start` from `web`. For frontend development, use `npm run dev` from the same directory.

## First video

1. Open **Connection** (`Подключение`). Configure FFmpeg and either a stable Songs directory or a lazer storage root. The bundled Studio executable is detected automatically when present.
2. For lazer, use **Find on this computer** (`Найти на компьютере`) and **Connect and refresh index** (`Подключить и обновить индекс`). A Songs directory is optional in this case. For stable, save the paths; importing replays looks up the map automatically.
3. Drop `.osr` files into **Create video** or import a folder. All attempts must belong to **one exact map version**; mixed-map batches are rejected without importing any files. Attempts are selected automatically.
4. Choose a palette and comparison mode. Replay Showcase keeps attempts visible; Combo Break eliminates them on a combo break. Setting the minimum surviving players to zero allows every attempt to be eliminated.
5. Optionally render a short preview, then create the video. Outputs and logs appear in the rendering queue. After successful full video creation, uploaded replay copies are deleted once queued jobs finish using them. Settings stay available for the next video within the same browser tab session.

## How lazer storage is used

Studio treats lazer as a local reference library. It opens `client.realm` dynamically in **read-only mode**, without migrations or writes, and stores map metadata and resource references in its own SQLite database. Beatmaps, music, backgrounds, and videos are not copied into the repository.

The storage root must contain `client.realm` and `files`; the usual Windows location is `%APPDATA%\osu`. Maps are matched by the MD5 recorded in the replay. A newer map with the same title is not substituted for a missing version. No API credentials are required for this local lookup.

Because danser expects a conventional Songs layout, each lazer render creates a temporary directory in the system TEMP folder containing hard links to the selected map and its set's resources. These links refer to the existing data without duplicating file contents. They are removed after completion, failure, or cancellation. A service crash can leave temporary links behind. Across different drives, symbolic links are attempted; if Windows prohibits them, the job fails with an explanation rather than silently copying the files. Refresh the index after moving storage or updating maps.

## Data and privacy

The service binds to `127.0.0.1` and processes imports locally. Replay copies in `web/data/library` are temporary: a successful full render releases its selected copies after other queued jobs finish using them. Preview, failure, or cancellation alone does not delete replays. Original files are never moved or deleted. **New render** clears uploaded copies while retaining settings, and is unavailable until pending jobs finish.

Render settings are kept in browser `sessionStorage`, survive page refreshes, and are not saved as projects. Jobs retain a settings snapshot while queued or retryable; when their replays are cleaned, that snapshot and retry are removed. Engine settings and job manifests are removed after every job. Completed videos, job logs, map indexes, local connection paths, and imported map/skin assets remain available. Imported `.osk` files are unpacked into a managed skin directory; external skin folders are referenced directly.

API secrets are stored separately in the engine's `settings/credentials.json`. The engine may contact osu! services for features that use online data. User data, videos, and managed assets are excluded from Git. Data left by older versions is not automatically purged on upgrade; use **New render** to clear old replay copies.

## Development and validation

```powershell
cd web
npm test
npm run build
```

The Node tests cover replay parsing, palettes, persistence, settings merging, argument generation, and lazer reference/link handling. `Build-Engine.ps1` runs the relevant Go checks.

With the engine, resources, FFmpeg, and ffprobe installed:

```powershell
cd web
node test/integration.mjs
node test/lazer-integration.mjs "C:\path\to\lazer-storage"
```

Set `STUDIO_TEST_FFMPEG` to a full FFmpeg path if it is not on PATH. The standard integration test uses a generated map and replays. The lazer integration test reads actual local storage, resolves a map from a synthetic replay, renders a video, checks that the database and map content are unchanged, and verifies temporary-link cleanup. Both use separate test libraries under `web/data`.

The server accepts `PORT` and `STUDIO_DATA_DIR` for an isolated instance. Engine integration tests should run sequentially because the engine shares its runtime database/settings directories.

## Repository layout

| Path | Purpose |
| --- | --- |
| `web/src` | React/TypeScript interface |
| `web/server` | Local Express service, SQLite storage, imports and rendering |
| `web/shared` | Shared palette logic |
| `web/test` | Unit and integration checks |
| `danser-go` | Vendored upstream engine with Studio modifications |
| `tools/LazerIndex` | Read-only Realm index helper |
| `Build-*.ps1` | Engine and helper build scripts |
| `Start-Studio.*` | Windows startup scripts |

Local development notes and temporary screenshots are kept in `.local-work/`, which is excluded from the repository.

## Current limitations

- Early working version; there is no full installer or automatic map download.
- One map per scene; multiple-map video editing and render pause are not implemented.
- Live engine playback uses a native window, not an embedded browser renderer.
- The settings editor exposes the current Go configuration schema. Some labels remain in English, complex arrays use JSON, dynamic choices need manual input, and visibility conditions are shown as hints.
- Main render controls override the corresponding engine JSON values when a job starts. Fixed comparison palettes disable cursor rainbow and beat flashes.
- Browser video playback depends on the selected codec; MP4/H.264/AAC is the usual interoperable choice.
- Real lazer replay/mod combinations still need broader validation. Matching a map does not by itself guarantee perfect playback compatibility.
- Linux packaging has not been tested; macOS is not supported by upstream danser-go.

## Engine changes and licensing

Studio adds `-studio-version`, a `-studio-manifest` protocol for replay batches and stable colors keyed by replay SHA-256, and `DANSER_STUDIO_FFMPEG` for selecting FFmpeg. The original engine and its notices remain in `danser-go`.

Project source is provided under **GPL-3.0**, following the original engine; see [LICENSE](LICENSE) and [upstream credits](danser-go/CREDITS.md). Bundled third-party assets and native libraries retain their respective licenses. Binary distribution must include the applicable source and license notices. See [Wieku/danser-go](https://github.com/Wieku/danser-go) for upstream development and documentation.
