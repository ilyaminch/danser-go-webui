import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  rm,
  access,
  mkdir,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  extractArchive,
  importMapArchive,
  importSkin,
  listSkins,
  selectedSkin,
} from "../server/assets.mjs";
import { openStore } from "../server/store.mjs";

import { zip } from "./archive-fixture.mjs";

test("skin archive import keeps nested assets and resolves the engine folder", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-skins-")),
    store = openStore(root);
  try {
    const archive = zip([
      ["skin.ini", "[General]\nName: Test"],
      ["fonts/score.png", "png"],
    ]);
    const [skin, same] = await Promise.all([
      importSkin(root, archive, "Test.osk"),
      importSkin(root, archive, "Test.osk"),
    ]);
    assert.equal(skin.id, same.id);
    const list = await listSkins(store, root);
    assert.deepEqual(list, [{ id: skin.id, label: "Test" }]);
    const selected = await selectedSkin(store, skin.id);
    assert.equal(path.join(selected.directory, selected.name), skin.root);
    assert.equal(
      await readFile(path.join(skin.root, "fonts/score.png"), "utf8"),
      "png",
    );
    const external = path.join(root, "external"),
      folder = path.join(external, "FolderSkin");
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(external, "Test.osk"), archive);
    store.put("config", { id: "local", skinsDir: external });
    const combined = await listSkins(store, root);
    assert.equal(combined.length, 2, "Cached/local archive appears twice");
    const local = await selectedSkin(
      store,
      combined.find((s) => s.label === "FolderSkin").id,
    );
    assert.equal(path.join(local.directory, local.name), folder);
    assert.deepEqual(await readFile(path.join(external, "Test.osk")), archive);
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});
test("archive traversal, Windows aliases and duplicate names are rejected and partial data removed", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-zip-"));
  try {
    for (const name of [
      "../outside",
      "C:/outside",
      "nested/CON.png",
      "nested/file.",
      "GOOD",
    ]) {
      const destination = path.join(root, "extract");
      await assert.rejects(
        extractArchive(
          zip([
            ["good", "initial"],
            [name, "bad"],
          ]),
          destination,
        ),
      );
      await assert.rejects(access(destination));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("manual map archive retains music beside the exact map", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-osz-")),
    store = openStore(root);
  try {
    const result = await importMapArchive(
      store,
      root,
      zip([
        [
          "map.osu",
          "osu file format v14\n[General]\nAudioFilename: song.mp3\nMode: 0\n[Metadata]\nTitle: Manual\n[HitObjects]\n256,192,1000,1,0",
        ],
        ["song.mp3", "music"],
      ]),
      "map.osz",
    );
    assert.equal(result.maps.length, 1);
    const map = store.get("map", result.maps[0].hash);
    assert.equal(map.source, "manual");
    assert.equal(
      await readFile(path.join(path.dirname(map.path), "song.mp3"), "utf8"),
      "music",
    );
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});
