import test from "node:test";
import assert from "node:assert/strict";
import {
  buildArguments,
  validateProject,
  createRenderer,
} from "../server/render.mjs";

const project = () => ({
  name: "Scene",
  kind: "dance",
  mapHash: "map",
  replayIds: ["stale-upload"],
  palette: { mode: "date", spacing: "rank", stops: ["#ff0000", "#00ff00"] },
  rules: { mode: 0, minPlayers: 0, grace: -10, sortBy: "Score" },
  export: {
    width: 1920,
    height: 1080,
    fps: 60,
    encoder: "h264_nvenc",
    container: "mp4",
  },
  launch: { speed: 1, pitch: 1, cursors: 1, tag: 1 },
  configPatch: {},
});
const store = {
  get: (kind, id) => (kind === "map" && id === "map" ? { hash: "map" } : null),
  list: () => [],
};
test("map-only scenarios do not consume or validate irrelevant uploaded replays", () => {
  for (const kind of ["dance", "autoplay", "classic"])
    assert.deepEqual(
      validateProject({ ...project(), kind }, store).replays,
      [],
    );
  assert.throws(
    () => validateProject({ ...project(), kind: "comparison" }, store),
    /отсутствует/,
  );
});
test("autoplay retains AT with classic or lazer mods without duplicating it", () => {
  for (const mods of ["", "HD", "HDAT"]) {
    const p = { ...project(), kind: "autoplay", launch: { mods } };
    const args = buildArguments(p, "settings", "manifest", [], "out", "record");
    assert.equal(
      args[args.indexOf("-mods") + 1],
      mods.includes("AT") ? mods : mods + "AT",
    );
  }
  for (const mods of [[{ acronym: "HD" }], [{ acronym: "AT" }]]) {
    const p = {
      ...project(),
      kind: "autoplay",
      launch: { mods2: JSON.stringify(mods) },
    };
    const args = buildArguments(p, "settings", "manifest", [], "out", "record");
    const actual = JSON.parse(args[args.indexOf("-mods2") + 1]);
    assert.equal(actual.filter((m) => m.acronym === "AT").length, 1);
    assert.equal(actual[0].acronym, mods[0].acronym);
  }
});
test("web rendering rejects interactive play and native-window actions", async () => {
  assert.throws(
    () => validateProject({ ...project(), kind: "play" }, store),
    /сценарий/,
  );
  const renderer = createRenderer(store, ".");
  await assert.rejects(
    renderer.enqueue({ ...project(), replayIds: [] }, "watch"),
    /действие/,
  );
});
