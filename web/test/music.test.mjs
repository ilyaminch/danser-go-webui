import test from "node:test";
import assert from "node:assert/strict";
import { previewStart } from "../shared/music.mjs";

test("music starts at PreviewTime, including zero, and falls back within the track", () => {
  assert.equal(previewStart(65400, 180, 170), 65.4);
  assert.equal(previewStart(0, 180, 170), 0);
  assert.equal(previewStart(-1, 180, 170), 68);
  assert.equal(previewStart(-1, 180), 72);
  assert.equal(previewStart(180000, 180, 500), 72);
  assert.equal(previewStart(NaN, 180, 0), 72);
  assert.equal(previewStart(-1, Infinity), 0);
  assert.equal(previewStart(-1, 0), 0);
});
