import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, access, readdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { detectLazer, readLazerIndex, storageFile } from "../server/lazer.mjs";
import { makeReplay } from "./fixtures.mjs";

const lazer = process.argv[2] || (await detectLazer());
if (!lazer) throw new Error("Укажите корневую папку lazer");
const testFFmpeg = process.env.STUDIO_TEST_FFMPEG || "ffmpeg";
if (path.isAbsolute(testFFmpeg))
  process.env.PATH =
    path.dirname(testFFmpeg) + path.delimiter + (process.env.PATH || "");
const fingerprint = async (file) =>
  createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
const database = path.join(lazer, "client.realm"),
  before = await fingerprint(database),
  raw = await readLazerIndex(lazer);
const candidate = raw.maps.find((m) =>
  raw.sets[m.setKey].some((f) => /\.(mp3|ogg|wav)$/i.test(f.name)),
);
assert.ok(candidate, "Нет карт с аудио для проверки");
const mapPath = storageFile(lazer, candidate.sha256),
  mapBefore = await fingerprint(mapPath);
const root = path.resolve(".."),
  testDir = path.resolve("data/lazer-integration", String(Date.now())),
  port = 3106;
await mkdir(testDir, { recursive: true });
const server = spawn(process.execPath, ["server/index.mjs"], {
  cwd: path.join(root, "web"),
  env: {
    ...process.env,
    PORT: String(port),
    STUDIO_DATA_DIR: path.join(testDir, "store"),
  },
  windowsHide: true,
});
let log = "";
server.stdout.on("data", (b) => (log += b));
server.stderr.on("data", (b) => (log += b));
const request = async (endpoint, method = "GET", data) => {
  const options = { method, headers: { "X-Studio-Client": "1" } };
  if (data instanceof FormData) options.body = data;
  else if (data !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(data);
  }
  const r = await fetch(`http://127.0.0.1:${port}/api${endpoint}`, options),
    result = await r.json();
  if (!r.ok) throw new Error(result.error);
  return result;
};
async function until(fn, timeout = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await fn();
    if (result) return result;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Превышено время проверки");
}
try {
  await until(async () => {
    try {
      return await request("/state");
    } catch {
      return false;
    }
  }, 20000);
  await request("/config", "PUT", {
    enginePath: path.join(root, "runtime/danser-studio.exe"),
    songsDir: "",
    lazerDir: lazer,
    ffmpegPath: testFFmpeg,
    outputDir: path.join(testDir, "videos"),
    skinsDir: "",
    replaysDir: "",
  });
  const health = await request("/health");
  assert.ok(health.lazer && !health.songs && health.engine);
  const form = new FormData();
  form.append(
    "files",
    new Blob([await makeReplay({ mapHash: candidate.hash })]),
    "lazer-lookup-test.osr",
  );
  const imported = await request("/import", "POST", form);
  assert.equal(imported.errors.length, 0);
  assert.equal(imported.mapErrors.length, 0);
  const state = await request("/state"),
    map = state.maps.find((m) => m.hash === candidate.hash);
  assert.equal(map.source, "lazer");
  assert.equal(map.path, mapPath);
  const base = {
    name: "Lazer local reference test",
    kind: "autoplay",
    mapHash: map.hash,
    replayIds: [],
    palette: {
      mode: "date",
      spacing: "rank",
      stops: ["#ff0000", "#00ff00"],
      reverse: false,
      unknown: "#999999",
      players: {},
      overrides: {},
    },
    rules: {
      mode: 2,
      minPlayers: 0,
      grace: -10,
      revive: false,
      addDanser: false,
      liveSort: true,
      sortBy: "Score",
    },
    export: {
      width: 640,
      height: 360,
      fps: 30,
      encoder: "libx264",
      container: "mp4",
    },
    launch: {
      speed: 1,
      pitch: 1,
      cursors: 1,
      tag: 1,
      start: map.firstTime,
      end: map.firstTime + 3,
      noUpdateCheck: true,
      noDbCheck: true,
    },
    configPatch: {
      General: { DiscordPresenceOn: false },
      Recording: { MotionBlur: { Enabled: false } },
      Playfield: {
        LeadInTime: 0,
        LeadInHold: 0,
        FadeOutTime: 0,
        SeizureWarning: { Enabled: false },
      },
    },
  };
  const queued = await request("/jobs", "POST", {
    project: base,
    action: "record",
  });
  console.log(`Lazer indexed: ${state.maps.length}, rendering ${queued.id}`);
  const job = await until(async () => {
    const s = await request("/state"),
      j = s.jobs.find((j) => j.id === queued.id);
    return j && !["queued", "running"].includes(j.status) ? j : false;
  });
  await writeFile(path.join(testDir, "render.log"), job.log);
  assert.equal(
    job.status,
    "completed",
    `${job.error}\n${job.log.slice(-6000)}`,
  );
  assert.ok(job.media.duration > 0);
  assert.ok(!job.args.includes("-nodbcheck"));
  await access(job.output);
  await until(async () => {
    try {
      await access(
        path.join(root, "runtime/settings/studio", `${job.id}.json`),
      );
      return false;
    } catch {
      return true;
    }
  }, 10000);
  assert.ok(
    !(await readdir(path.join(tmpdir(), "danser-studio"))).some((name) =>
      name.startsWith("maps-"),
    ),
    "Temporary map view remains",
  );
  assert.equal(await fingerprint(database), before, "База lazer изменена");
  assert.equal(await fingerprint(mapPath), mapBefore, "Файл карты изменён");
  assert.ok(!(await readdir(path.join(testDir, "store"))).includes("Songs"));
  const result = {
    ok: true,
    indexed: state.maps.length,
    errors: imported.mapErrors.length,
    video: job.output,
    duration: job.media.duration,
    databaseUnchanged: true,
    mapUnchanged: true,
    temporaryViewRemoved: true,
  };
  await writeFile(
    path.join(testDir, "result.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  server.kill();
  await writeFile(path.join(testDir, "server.log"), log);
}
