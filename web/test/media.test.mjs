import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseMedia, resolveMedia } from "../server/media.mjs";
import { storageFile } from "../server/lazer.mjs";

test("media uses actual osu event names, not background.jpg", () => {
  assert.deepEqual(
    parseMedia(
      '\ufeffosu file format v14\n[General]\nAudioFilename: music song.ogg\n[Events]\n//Background\n0,0,"art, final.png",0,0\n',
    ),
    { audio: "music song.ogg", background: "art, final.png", previewTime: -1 },
  );
  assert.deepEqual(parseMedia('[Events]\nVideo,0,"movie.mp4"'), {
    audio: "",
    background: "",
    previewTime: -1,
  });
});
test("media resolves local and lazer resources read-only and rejects traversal", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "studio-media-"));
  try {
    const osu = path.join(root, "map.osu");
    await writeFile(
      osu,
      '[General]\nAudioFilename: track.ogg\n[Events]\n0,0,"cover.png",0,0',
    );
    await writeFile(path.join(root, "track.ogg"), "audio");
    await writeFile(path.join(root, "cover.png"), "image");
    const store = { get: () => null };
    assert.equal(
      (await resolveMedia(store, { path: osu, source: "manual" }, "background"))
        .path,
      path.join(root, "cover.png"),
    );
    const before = await readFile(osu);
    const digest = createHash("sha256").update("audio").digest("hex");
    const file = storageFile(root, digest);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, "audio");
    const lazer = {
      get: () => ({ root, files: [{ name: "track.ogg", sha256: digest }] }),
    };
    assert.equal(
      (
        await resolveMedia(
          lazer,
          {
            path: osu,
            source: "lazer",
            sourceRoot: root,
            filename: "map.osu",
            setKey: "set",
          },
          "audio",
        )
      ).path,
      file,
    );
    assert.deepEqual(await readFile(osu), before);
    await writeFile(osu, "[General]\nAudioFilename: ../outside.ogg");
    await assert.rejects(() => resolveMedia(store, { path: osu }, "audio"));
    await writeFile(osu, "[General]\nAudioFilename: missing.ogg");
    assert.equal(await resolveMedia(store, { path: osu }, "audio"), null);
    await assert.rejects(() => resolveMedia(store, { path: osu }, "anything"));
  } finally {
    const relative = path.relative(tmpdir(), root);
    assert.ok(
      relative && !relative.startsWith("..") && !path.isAbsolute(relative),
    );
    await rm(root, { recursive: true, force: true });
  }
});

test("media reads valid preview timestamps and tolerates missing or invalid values", () => {
  for (const [value, expected] of [
    ["65400", 65400],
    ["0", 0],
    ["-1", -1],
    ["", -1],
    ["wrong", -1],
    ["1.5", -1],
    ["99999999999999999999", -1],
  ])
    assert.equal(
      parseMedia(`[General]\nPreviewTime: ${value}`).previewTime,
      expected,
    );
});
