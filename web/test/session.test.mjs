import test from "node:test";
import assert from "node:assert/strict";
import {
  restoreRenderSettings,
  storedVolume,
  readSession,
  writeSession,
} from "../shared/session.mjs";

const defaults = () => ({
  name: "",
  kind: "comparison",
  visualization: "dance",
  replayIds: [],
  mapHash: "",
  palette: {
    stops: ["#ff0000", "#00ff00"],
    mode: "date",
    players: {},
    overrides: {},
  },
  rules: { mode: 0, minPlayers: 0 },
  export: { width: 1920, encoder: "h264_nvenc" },
  launch: { speed: 1, skinId: "" },
  configPatch: { Recording: { EncodingFPSCap: 0 } },
});

test("session restoration tolerates invalid/partial data and restores nested defaults", () => {
  for (const value of [null, "{", "null", "[]", "42"])
    assert.deepEqual(
      restoreRenderSettings(defaults(), value, true),
      defaults(),
    );
  const p = restoreRenderSettings(
    defaults(),
    JSON.stringify({
      kind: "classic",
      replayIds: ["obsolete"],
      mapHash: "old",
      rules: null,
      export: { encoder: "libx264" },
      launch: { ar: 10 },
      palette: { mode: "per-player", stops: null, players: null },
      configPatch: null,
    }),
    true,
  );
  assert.equal(p.kind, "comparison");
  assert.equal(p.launch.speed, 1);
  assert.equal(p.launch.ar, 10);
  assert.deepEqual(p.rules, defaults().rules);
  assert.deepEqual(p.palette.stops, defaults().palette.stops);
  assert.deepEqual(p.palette.players, {});
  assert.equal(p.palette.mode, "date");
  assert.equal(p.export.width, 1920);
  assert.equal(p.export.encoder, "libx264");
  assert.deepEqual(p.configPatch, defaults().configPatch);
  assert.deepEqual(p.replayIds, []);
  assert.equal(p.mapHash, "");
});
test("recording migration preserves unrelated settings and visualization choices", () => {
  const raw = JSON.stringify({
    kind: "autoplay",
    visualization: "autoplay",
    launch: { mods: "HD" },
    configPatch: { Cursor: { Size: 2 }, Recording: { EncodingFPSCap: 60 } },
  });
  const p = restoreRenderSettings(defaults(), raw, false);
  assert.equal(p.visualization, "autoplay");
  assert.equal(p.launch.mods, "HD");
  assert.equal(p.configPatch.Cursor.Size, 2);
  assert.equal(p.configPatch.Recording.EncodingFPSCap, 0);
});
test("music volume stays finite and within the HTML audio range", () => {
  for (const value of [null, "", "garbage", "NaN", "Infinity"])
    assert.equal(storedVolume(value), 0.25);
  assert.equal(storedVolume("-1"), 0);
  assert.equal(storedVolume("2"), 1);
  assert.equal(storedVolume("0"), 0);
  assert.equal(storedVolume("0.6"), 0.6);
});
test("blocked or full browser storage does not crash the workspace", () => {
  const original = Object.getOwnPropertyDescriptor(
    globalThis,
    "sessionStorage",
  );
  try {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });
    assert.equal(readSession("settings"), null);
    assert.doesNotThrow(() => writeSession("settings", "{}"));
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem: () => "saved",
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
    });
    assert.equal(readSession("settings"), "saved");
    assert.doesNotThrow(() => writeSession("settings", "{}"));
  } finally {
    if (original) Object.defineProperty(globalThis, "sessionStorage", original);
    else delete globalThis.sessionStorage;
  }
});
