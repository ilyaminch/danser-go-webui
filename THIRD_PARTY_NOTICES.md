# Third-party software and runtime resources

Danser Studio and its engine modifications are GPLv3. The release includes corresponding Studio sources separately; see SOURCE.md.

- Node.js 24.18.0: MIT and included third-party notices, shipped in `.runtime/node/LICENSE`; official source: https://nodejs.org/dist/v24.18.0/ .
- Production JavaScript dependencies: pinned by `web/package-lock.json`; their license files are retained in `web/node_modules`.
- Engine: fork of Wieku/danser-go; original copyright and GPLv3 license preserved. Its CREDITS.md covers libraries and assets with separate conditions.
- Winpthreads runtime: MIT/BSD notices retained in `packaging/licenses/winpthreads.txt`; https://github.com/mingw-w64/mingw-w64/tree/master/mingw-w64-libraries/winpthreads .
- Lazer index helper: Studio C# sources are included in the source archive; .NET runtime is MIT, Realm 20.1.0 is Apache-2.0. Their license/notice files are in `packaging/licenses/`. Sources: https://github.com/dotnet/runtime and https://github.com/realm/realm-dotnet/tree/20.1.0 .

The first launch downloads unmodified runtime resources from the official danser-go 0.12.0 distribution and FFmpeg 9.0.2 from Gyan's distribution, verifying pinned SHA256 hashes before extraction. These archives are not republished in the Studio package.

BASS is supplied by that original runtime distribution and is free for noncommercial use under its own conditions. Commercial use requires appropriate licensing from Un4seen. Default skin artwork is used by upstream with its creator's permission; the original asset credits are preserved in `runtime/CREDITS.md`. Downloading these files does not change their licenses. FFmpeg's original LICENSE/README accompany its downloaded executable files. Sources: https://www.un4seen.com/bass.html and https://github.com/Wieku/danser-go/blob/master/CREDITS.md .
