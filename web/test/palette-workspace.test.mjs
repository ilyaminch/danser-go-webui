import test from "node:test";
import assert from "node:assert/strict";
import {
  assignColors,
  capturePalette,
  setGradientEnabled,
} from "../shared/palette.mjs";
import { restoreRenderSettings } from "../shared/session.mjs";

const replays = [
  { id: "old", player: "A", date: "2026-01-01T10:00:00Z" },
  { id: "middle", player: "A", date: "2026-01-01T11:00:00Z" },
  { id: "new", player: "A", date: "2026-01-01T12:00:00Z" },
];
const palette = {
  mode: "date",
  enabled: true,
  spacing: "rank",
  stops: ["#ff0000", "#00ff00"],
  reverse: false,
  unknown: "#9198a8",
  players: {},
  overrides: {},
  frozen: {},
};

test("queued palette keeps whole-batch colors for one selected attempt", () => {
  const colors = assignColors(replays, palette);
  const snapshot = capturePalette(replays, palette);
  for (const replay of replays)
    assert.equal(
      assignColors([replay], snapshot)[replay.id],
      colors[replay.id],
    );
  assert.deepEqual(palette.overrides, {});
  assert.equal(assignColors([replays[2]], palette).new, "#ff0000");
  assert.equal(assignColors([replays[2]], snapshot).new, "#00ff00");
});

test("disabling freezes automatic colors while preserving manual overrides", () => {
  const manual = { ...palette, overrides: { middle: "#123456" } };
  const before = assignColors(replays, manual);
  const off = setGradientEnabled(replays, manual, false);
  assert.deepEqual(assignColors(replays, off), before);
  assert.deepEqual(off.overrides, manual.overrides);
  assert.notEqual(off.frozen.middle, "#123456");
  assert.deepEqual(
    assignColors(replays.slice(1), {
      ...off,
      reverse: true,
      stops: ["#111111", "#222222"],
    }),
    { middle: "#123456", new: before.new },
  );
  const reset = { ...off, overrides: {} };
  assert.equal(assignColors(replays, reset).middle, off.frozen.middle);
  const on = setGradientEnabled(replays, off, true);
  assert.deepEqual(assignColors(replays, on), before);
  assert.deepEqual(on.frozen, {});
  assert.equal(setGradientEnabled(replays, off, false), off);
});

test("new attempts while off get a fixed neutral color and can be edited", () => {
  const off = setGradientEnabled(replays, palette, false);
  const extra = { id: "extra", player: "B", date: "2027-01-01T00:00:00Z" };
  assert.equal(assignColors([...replays, extra], off).extra, palette.unknown);
  const snapshot = capturePalette([...replays, extra], {
    ...off,
    overrides: { extra: "#abcdef" },
  });
  assert.equal(assignColors([extra], snapshot).extra, "#abcdef");
  assert.equal(assignColors([replays[2]], snapshot).new, "#00ff00");
});

test("session restores off state and frozen colors, legacy sessions default on", () => {
  const defaults = {
    palette,
    rules: {},
    export: {},
    launch: {},
    configPatch: {},
  };
  const off = setGradientEnabled(replays, palette, false);
  const restored = restoreRenderSettings(
    defaults,
    JSON.stringify({ palette: off }),
    true,
  );
  assert.equal(restored.palette.enabled, false);
  assert.deepEqual(
    assignColors(replays, restored.palette),
    assignColors(replays, off),
  );
  assert.equal(
    restoreRenderSettings(
      defaults,
      JSON.stringify({ palette: { stops: palette.stops } }),
      true,
    ).palette.enabled,
    true,
  );
  assert.deepEqual(
    restoreRenderSettings(
      defaults,
      JSON.stringify({ palette: { enabled: false, frozen: [] } }),
      true,
    ).palette.frozen,
    {},
  );
});
