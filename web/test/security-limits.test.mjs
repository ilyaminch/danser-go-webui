import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import multer from "multer";
import { once } from "node:events";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  frameProtection,
  boundedMemoryStorage,
  createImportGate,
} from "../server/import-security.mjs";
import { EventEmitter } from "node:events";
import {
  MAP_BYTES,
  MAP_LINE_BYTES,
  readLimitedFile,
} from "../server/limits.mjs";
import { parseMap } from "../server/maps.mjs";
import { decompress } from "../server/replay.mjs";
import { compress, makeMap } from "./fixtures.mjs";

test("file-only multipart rejects fields and counts chunked aggregate bytes", async (t) => {
  const app = express();
  app.use(frameProtection);
  const upload = multer({
    storage: boundedMemoryStorage(16),
    limits: { fields: 0, files: 2, parts: 2, fileSize: 16 },
  });
  app.get("/", (_req, res) => res.send("fixture"));
  app.post("/", upload.array("files"), (req, res) =>
    res.json({ count: req.files.length }),
  );
  app.use((error, _req, res, _next) =>
    res.status(413).json({ error: error.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}/`;
  const page = await fetch(url);
  assert.equal(
    page.headers.get("content-security-policy"),
    "frame-ancestors 'none'",
  );
  assert.equal(page.headers.get("x-frame-options"), "DENY");
  const normal = new FormData();
  normal.append("files", new Blob(["small"]), "a.osr");
  assert.equal(
    (await fetch(url, { method: "POST", body: normal })).status,
    200,
  );
  const fields = new FormData();
  fields.append("metadata[nested][999999]", "unused");
  assert.equal(
    (await fetch(url, { method: "POST", body: fields })).status,
    413,
  );
  const boundary = "fixture-boundary";
  const payload =
    ["a", "b"]
      .map(
        (name) =>
          `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${name}.osr"\r\nContent-Type: application/octet-stream\r\n\r\n123456789\r\n`,
      )
      .join("") + `--${boundary}--\r\n`;
  async function* chunks() {
    for (let i = 0; i < payload.length; i += 7)
      yield Buffer.from(payload.slice(i, i + 7));
  }
  const rejected = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body: chunks(),
    duplex: "half",
  });
  assert.equal(rejected.status, 413);
});

test("bounded file reads and map text preserve ordinary maps and reject oversized input", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "studio-security-"));
  const file = path.join(dir, "fixture.osu");
  await writeFile(file, "12345");
  assert.equal((await readLimitedFile(file, 5)).length, 5);
  await assert.rejects(readLimitedFile(file, 4), /превышает/);
  assert.ok(parseMap(Buffer.from(makeMap()), file).hash);
  assert.throws(() => parseMap(Buffer.alloc(MAP_BYTES + 1), file), /8 МБ/);
  assert.throws(
    () => parseMap(Buffer.alloc(MAP_LINE_BYTES + 1, 65), file),
    /64 КБ/,
  );
});

test("LZMA caps actual decoded bytes for both declared and unknown sizes", async () => {
  const compressed = await compress("bounded fixture");
  assert.equal(await decompress(compressed, 64), "bounded fixture");
  const unknown = Buffer.from(compressed);
  unknown.fill(255, 5, 13);
  assert.equal(await decompress(unknown, 64), "bounded fixture");
  await assert.rejects(async () => decompress(unknown, 4), /budget/);
  assert.throws(() => decompress(compressed, 4), /лимит/);
  const dictionary = Buffer.from(compressed);
  dictionary.writeUInt32LE(0x7fffffff, 1);
  assert.throws(() => decompress(dictionary), /Словарь/);
});

test("import gate retains ownership until response or handler completion", () => {
  const gate = createImportGate();
  const first = new EventEmitter(),
    response = new EventEmitter();
  let admitted = 0,
    status;
  const rejected = {
    status(value) {
      status = value;
      return this;
    },
    json() {},
  };
  gate(first, response, () => admitted++);
  response.emit("close"); // Disconnect after body receipt must not release running work.
  gate(new EventEmitter(), rejected, () => admitted++);
  assert.equal(status, 429);
  assert.equal(admitted, 1);
  first.releaseImport();
  const second = new EventEmitter(),
    nextResponse = new EventEmitter();
  gate(second, nextResponse, () => admitted++);
  assert.equal(admitted, 2);
  nextResponse.emit("finish");
  second.releaseImport();
});
