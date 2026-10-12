import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { openStore } from "../server/store.mjs";

test("compact polling omits catalog and logs while downloads and full state retain them", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "studio-polling-"));
  const store = openStore(dir);
  store.put("job", {
    id: "test-job",
    status: "completed",
    progress: 100,
    log: "render log\n".repeat(10000),
    project: {},
    config: {},
  });
  store.put("map", { id: "test-map", hash: "exact-hash", title: "Map" });
  store.close();
  const port = 18742;
  const server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: { ...process.env, PORT: String(port), STUDIO_DATA_DIR: dir },
    windowsHide: true,
    stdio: "ignore",
  });
  t.after(async () => {
    if (server.exitCode === null) {
      const exited = once(server, "exit");
      server.kill();
      await exited;
    }
  });
  const base = `http://127.0.0.1:${port}/api`;
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${base}/state?compact=1`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, "isolated server starts");
  const compactResponse = await fetch(`${base}/state?compact=1`);
  const compactText = await compactResponse.text();
  const compact = JSON.parse(compactText);
  assert.equal(compact.maps, undefined);
  assert.equal(compact.jobs[0].log, undefined);
  assert.equal(compact.jobs[0].progress, 100);
  const catalog = await (
    await fetch(`${base}/state?compact=1&catalog=1`)
  ).json();
  assert.equal(catalog.maps[0].hash, "exact-hash");
  assert.equal(catalog.jobs[0].log, undefined);
  const fullText = await (await fetch(`${base}/state`)).text();
  assert.ok(fullText.length > compactText.length * 20);
  assert.equal(JSON.parse(fullText).jobs[0].log.length, 110000);
  const log = await fetch(`${base}/jobs/test-job/log`);
  assert.match(log.headers.get("content-disposition"), /attachment/);
  assert.equal((await log.text()).length, 110000);
  assert.equal((await fetch(`${base}/jobs/missing/log`)).status, 404);
});
