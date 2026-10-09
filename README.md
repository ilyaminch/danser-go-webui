# Danser Studio — danser-go Web UI

A local web interface for comparing osu!standard replays and rendering them into videos. Import attempts recorded on different dates, include friends' replays, assign cursor colors, and choose whether players remain visible or are eliminated.

Built on **[Wieku/danser-go](https://github.com/Wieku/danser-go)**. This is an unofficial companion project with a modified copy of the engine, not an official danser-go release. The vendored engine is based on upstream commit `2fc4c8931ff4446a411b0094d7d7b4ede82c61c4` and retains its original documentation and credits in [`danser-go/`](danser-go/README.md).

**Version 0.2.0** is the functional baseline before the frontend redesign. It remains an early working release with the setup requirements and limitations documented below. The `v0.2.0` Git tag preserves this version.

## Features

- Batch `.osr` import, duplicate detection, replay details, and replay groups.
- Arbitrary color gradients ordered by replay date, per-player gradients, player colors, and manual overrides. Colors remain attached to the same replay when the engine sorts players or eliminates them.
- All five native comparison modes: Combo Break, Max Combo, Replay Showcase, Vs Mode, and SS or Quit. Configure the minimum number of surviving players, initial grace period, revival, sorting, and the additional danser cursor.
- Local maps from osu!stable Songs folders or osu!lazer storage. Replay imports and selections resolve the exact map using its MD5 hash.
- One render workspace with colors, elimination, export, launch options, skin selection, and the complete engine settings editor. Render settings remain in the browser tab session; no saved projects are created.
- Local skin folders and `.osk` archives, plus manual `.osz` map import when the exact replay map is missing.
- Rendering queue, progress and logs, cancellation and retry, short video previews, PNG screenshots, and MP4/MKV export.
- Two scenarios selected by a switch: **Replay video** accepts one or more attempts of the same map; **Map visualization** offers Cursor Dance or autoplay with the gameplay interface, without replay uploads. A single attempt uses the same manifest workflow and danser automatically shows its score/combo interface. Classic folder knockout is not exposed.
- CS, AR, OD, and HP overrides are available only for map visualization. Replay video preserves the map difficulty and each attempt's recorded mods, including Difficulty Adjust; saved visualization overrides are ignored for replay rendering.
- Recording defaults: NVIDIA H.264 NVENC, preset p4, CQ 22, High profile, 1080p60 MP4, yuv420p, motion blur disabled, and no encoding speed cap. Select libx264 on computers without working NVENC. NVENC preset and quality are available beside the encoder.

The interface supports **Russian and English**, selectable in the header. Engine setting names and logs retain their original language. Windows is the tested platform.

## Redesigned workspace

The workspace is arranged around a persistent vinyl stage, with compact replay/map controls on the left and mode, cursor color, and skin controls on the right. Recommended video presets sit in the export dock; detailed encoding, timing, launch, JSON, and engine settings remain available in expandable sections.

Selecting a map loads its background and audio from the filenames in the actual `.osu`, including read-only lazer resources. Music starts automatically when a map is selected, using the current volume and mute preferences (25% initially). If the browser blocks autoplay, use the play button. Volume, mute, language, and animation preferences stay in the browser tab session. Listening does not change the rendered video's audio. Missing artwork or music leaves the rendering workflow available.

The vinyl grooves, reflections, and rhythm background are authored CSS/SVG. Exo 2 interface and Comfortaa branding fonts are bundled locally with their OFL licenses; see [`web/public/ASSETS.md`](web/public/ASSETS.md). The fullscreen 1920 × 1080 workspace keeps export visible and scrolls long panels independently; narrow screens use a stacked flow. Animation can be disabled and respects reduced-motion preferences.

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
3. Drop `.osr` files into **Create video** using the file picker. All attempts must belong to **one exact map version**; mixed-map batches are rejected without importing any files. Attempts are selected automatically.
4. Choose a palette and comparison mode. Replay Showcase keeps attempts visible; Combo Break eliminates them on a combo break. Setting the minimum surviving players to zero allows every attempt to be eliminated.
5. Optionally render a short preview, then create the video. Outputs and logs appear in the rendering queue. After successful full video creation, uploaded replay copies are deleted once queued jobs finish using them. Settings stay available for the next video within the same browser tab session.

To render without replays, turn on **Map visualization** (`Визуализация карты`), select Cursor Dance or Autoplay, and choose a locally indexed map or import a `.osz` archive. Cursor Dance generates automatic cursor movement; Autoplay uses the engine's automatic player and gameplay interface. Configure export settings and optionally preview before rendering.

In map visualization, **CS** controls circle size (higher means smaller circles), **AR** controls how early objects appear (higher means less reading time), **OD** controls hit timing strictness, and **HP** controls health drain difficulty. Blank fields retain the map's values with the selected mods. These fields are hidden for replay video because the native comparison workflow does not apply launch-time difficulty overrides.

## How lazer storage is used

Studio treats lazer as a local reference library. It opens `client.realm` dynamically in **read-only mode**, without migrations or writes, and stores map metadata and resource references in its own SQLite database. Beatmaps, music, backgrounds, and videos are not copied into the repository.

The storage root must contain `client.realm` and `files`; the usual Windows location is `%APPDATA%\osu`. Maps are matched by the MD5 recorded in the replay. A newer map with the same title is not substituted for a missing version. No API credentials are required for this local lookup.

Because danser expects a conventional Songs layout, each lazer render creates a temporary directory in the system TEMP folder containing hard links to the selected map and its set's resources. These links refer to the existing data without duplicating file contents. They are removed after completion, failure, or cancellation. A service crash can leave temporary links behind. Across different drives, symbolic links are attempted; if Windows prohibits them, the job fails with an explanation rather than silently copying the files. Refresh the index after moving storage or updating maps.

Lazer does not have ordinary Songs, Skins, or Replays directories: their contents share its hash-based storage. Connect the storage root rather than `files`. The connector currently resolves maps; import skins as `.osk` and replays as exported `.osr`. Lazer's `exports` folder contains files explicitly exported from the game, not every stored replay. Optional stable Songs and local skin directories remain under additional connection settings. The unused native-launcher replay-directory field is not exposed in the web interface.

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
node test/integration.mjs --manual
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

## Development workflow

`main` contains released versions; `develop` is the integration branch. Start feature and ordinary fix branches from an up-to-date `develop`, review changes against it, and integrate with merge commits. Prepare releases on `release/<version>`, merge them into `main` and back into `develop`, and tag the released commit. Completed branches can then be deleted without removing their commit history. Use Conventional Commits with concise English descriptions.

The frontend redesign will build on this baseline. Runtime builds, local replays, imported archives, databases, credentials, and generated media must stay outside version control.

## Current limitations

- Early working version; there is no full installer or automatic map download.
- One map per scene; multiple-map video editing and render pause are not implemented.
- The web interface provides video previews and screenshots. Interactive play and native window playback are not exposed through its API.
- The settings editor exposes the current Go configuration schema. Some labels remain in English, complex arrays use JSON, dynamic choices need manual input, and visibility conditions are shown as hints.
- Main render controls override the corresponding engine JSON values when a job starts. Fixed comparison palettes disable cursor rainbow and beat flashes.
- Browser video playback depends on the selected codec; MP4/H.264/AAC is the usual interoperable choice.
- Real lazer replay/mod combinations still need broader validation. Matching a map does not by itself guarantee perfect playback compatibility.
- Linux packaging has not been tested; macOS is not supported by upstream danser-go.

## Engine changes and licensing

Studio adds `-studio-version`, a `-studio-manifest` protocol for replay batches and stable colors keyed by replay SHA-256, and `DANSER_STUDIO_FFMPEG` for selecting FFmpeg. The original engine and its notices remain in `danser-go`.

Project source is provided under **GPL-3.0**, following the original engine; see [LICENSE](LICENSE) and [upstream credits](danser-go/CREDITS.md). Bundled third-party assets and native libraries retain their respective licenses. Binary distribution must include the applicable source and license notices. See [Wieku/danser-go](https://github.com/Wieku/danser-go) for upstream development and documentation.

Music preview starts at the selected .osu PreviewTime (milliseconds). Missing, negative, malformed or out-of-track values fall back to 40% of the map end time, capped by audio duration; if map timing is unavailable, audio duration is used. Seeking occurs after audio metadata loads, before autoplay. This affects listening only, not video export.
