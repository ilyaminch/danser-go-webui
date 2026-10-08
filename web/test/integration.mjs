import { spawn } from "node:child_process";
import { readFile, mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { writeFixtures, makeReplay } from "./fixtures.mjs";
import { zip } from "./archive-fixture.mjs";
import { runCommand } from "../server/render.mjs";

const root = path.resolve(".."),
  testDir = path.resolve("data/integration", String(Date.now())),
  port = 3105;
const testFFmpeg = process.env.STUDIO_TEST_FFMPEG || "ffmpeg";
const manual = process.argv.includes("--manual");
if (path.isAbsolute(testFFmpeg))
  process.env.PATH =
    path.dirname(testFFmpeg) + path.delimiter + (process.env.PATH || "");
await mkdir(testDir, { recursive: true });
const fixture = await writeFixtures(path.join(testDir, "fixtures"));
const server = spawn(process.execPath, ["server/index.mjs"], {
  cwd: path.join(root, "web"),
  env: {
    ...process.env,
    PORT: String(port),
    STUDIO_DATA_DIR: path.join(testDir, "store"),
  },
  windowsHide: true,
});
let serverLog = "";
server.stdout.on("data", (b) => (serverLog += b));
server.stderr.on("data", (b) => (serverLog += b));
const request = async (endpoint, method = "GET", data) => {
  const options = { method, headers: { "X-Studio-Client": "1" } };
  if (data instanceof FormData) options.body = data;
  else if (data !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(data);
  }
  const response = await fetch(
    `http://127.0.0.1:${port}/api${endpoint}`,
    options,
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
};
async function waitUntil(fn, timeout = 180000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const result = await fn();
    if (result) return result;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Превышено время ожидания");
}
try {
  await waitUntil(async () => {
    try {
      return await request("/state");
    } catch {
      return false;
    }
  }, 20000);
  const rejected = await fetch(`http://127.0.0.1:${port}/api/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(rejected.status, 403);
  await request("/config", "PUT", {
    enginePath: path.join(root, "runtime/danser-studio.exe"),
    songsDir: manual ? "" : fixture.songs,
    ffmpegPath: testFFmpeg,
    outputDir: path.join(testDir, "videos"),
    skinsDir: "",
    replaysDir: fixture.replays,
  });
  const health = await request("/health");
  assert.ok(
    health.engine && health.studio && health.ffmpeg && health.songs === !manual,
    JSON.stringify(health),
  );
  if (manual) {
    const archive = new FormData();
    archive.append(
      "file",
      new Blob([
        zip([
          [
            "training.osu",
            await readFile(
              path.join(fixture.songs, "Studio Test", "training.osu"),
            ),
          ],
          [
            "song.wav",
            await readFile(path.join(fixture.songs, "Studio Test", "song.wav")),
          ],
        ]),
      ]),
      "training.osz",
    );
    assert.equal(
      (await request("/maps/import", "POST", archive)).maps.length,
      1,
    );
  }
  // Import resolves stable Songs without visiting a separate map index screen.
  const form = new FormData();
  for (const name of ["old.osr", "new.osr"])
    form.append(
      "files",
      new Blob([await readFile(path.join(fixture.replays, name))]),
      name,
    );
  const invalid = new FormData();
  invalid.append(
    "files",
    new Blob([await makeReplay({ mode: 1 })]),
    "taiko.osr",
  );
  assert.equal((await request("/import", "POST", invalid)).errors.length, 1);
  const mixed = new FormData();
  mixed.append(
    "files",
    new Blob([await readFile(path.join(fixture.replays, "old.osr"))]),
    "old.osr",
  );
  mixed.append("files", new Blob([await makeReplay()]), "other-map.osr");
  await assert.rejects(request("/import", "POST", mixed), /разным картам/);
  assert.equal((await request("/state")).replays.length, 0);
  const imported = await request("/import", "POST", form);
  assert.equal(imported.imported.length, 2);
  assert.equal(imported.errors.length, 0);
  assert.equal((await request("/state")).maps.length, 1);
  const duplicate = new FormData();
  duplicate.append(
    "files",
    new Blob([await readFile(path.join(fixture.replays, "old.osr"))]),
    "renamed.osr",
  );
  assert.equal(
    (await request("/import", "POST", duplicate)).duplicates.length,
    1,
  );
  const project = {
    name: manual ? "Прогресс тренировок" : "Studio training test",
    kind: "comparison",
    mapHash: fixture.hash,
    replayIds: imported.imported.map((r) => r.id),
    palette: {
      mode: "date",
      spacing: "rank",
      stops: ["#ff0000", "#ffff00", "#00ff00"],
      reverse: false,
      unknown: "#999999",
      players: {},
      overrides: {},
    },
    rules: {
      mode: 0,
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
      start: 0,
      end: 7,
      screenshotTime: 3.5,
      noUpdateCheck: true,
      noDbCheck: manual,
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
      Audio: { GeneralVolume: 0.2 },
    },
  };
  const skinForm = new FormData();
  skinForm.append(
    "file",
    new Blob([
      zip([["skin.ini", "[General]\nName: Studio Test\nVersion: latest"]]),
    ]),
    "Studio Test.osk",
  );
  const skin = await request("/skins/import", "POST", skinForm);
  await request("/skins");
  project.launch.skinId = skin.id;
  await request("/render/validate", "POST", project);
  await assert.rejects(
    request("/jobs", "POST", { project, action: "watch" }),
    /действие/,
  );
  for (const kind of ["dance", "autoplay"]) {
    const queued = await request("/jobs", "POST", {
      project: {
        ...project,
        kind,
        replayIds: [],
        launch: { ...project.launch, mods: kind === "autoplay" ? "HD" : "" },
      },
      action: "preview",
    });
    const job = await waitUntil(async () => {
      const item = (await request("/state")).jobs.find(
        (j) => j.id === queued.id,
      );
      return item && !["queued", "running"].includes(item.status)
        ? item
        : false;
    });
    assert.equal(job.status, "completed", job.error || job.log.slice(-2000));
    assert.equal(
      (await request("/state")).replays.length,
      2,
      "Map-only preview removed uploads",
    );
    if (kind === "autoplay")
      assert.equal(job.args[job.args.indexOf("-mods") + 1], "HDAT");
  }
  const preview = await request("/jobs", "POST", {
    project,
    action: "preview",
  });
  const cancelled = await request("/jobs", "POST", {
    project,
    action: "screenshot",
  });
  await request("/jobs/" + cancelled.id + "/cancel", "POST");
  await waitUntil(async () => {
    const state = await request("/state");
    const job = state.jobs.find((j) => j.id === preview.id);
    return job?.status === "completed";
  });
  assert.equal(
    (await request("/state")).replays.length,
    2,
    "Preview or cancellation deleted the working attempts",
  );
  const failure = await request("/jobs", "POST", {
    project: {
      ...project,
      launch: { ...project.launch, skinId: "missing-skin" },
    },
    action: "record",
  });
  await waitUntil(async () => {
    const state = await request("/state");
    return state.jobs.find((j) => j.id === failure.id)?.status === "failed";
  });
  assert.equal(
    (await request("/state")).replays.length,
    2,
    "Failed render deleted attempts",
  );
  const first = await request("/jobs", "POST", { project, action: "record" });
  const second = await request("/jobs", "POST", {
    project: {
      ...project,
      name: "Studio showcase test",
      rules: { ...project.rules, mode: 2 },
    },
    action: "screenshot",
  });
  const third = await request("/jobs", "POST", {
    project: {
      ...project,
      name: "Studio late start test",
      launch: { ...project.launch, start: 3 },
    },
    action: "screenshot",
  });
  console.log(`Integration jobs: ${first.id}, ${second.id}, ${third.id}`);
  const all = await waitUntil(async () => {
    const state = await request("/state");
    const jobs = state.jobs.filter((j) =>
      [first.id, second.id, third.id].includes(j.id),
    );
    return jobs.length === 3 &&
      jobs.every((j) => !["running", "queued"].includes(j.status))
      ? jobs
      : false;
  });
  for (const job of all) {
    await writeFile(path.join(testDir, `${job.id}.log`), job.log);
    assert.equal(
      job.status,
      "completed",
      `${job.name}: ${job.error}\n${job.log.slice(-5000)}`,
    );
  }
  assert.ok(
    all[0].log.includes(skin.id),
    "Imported skin was not loaded by danser",
  );
  const record = all.find((j) => j.id === first.id),
    screenshot = all.find((j) => j.id === second.id),
    late = all.find((j) => j.id === third.id);
  if (manual) assert.ok(!record.args.includes("-nodbcheck"));
  assert.equal(
    [...record.log.matchAll(/has broken! Max combo:/g)].length,
    1,
    "Exactly the old replay should be eliminated",
  );
  assert.ok(
    record.log.includes("100.00"),
    "The new attempt should finish with 100% accuracy",
  );
  assert.ok(
    !screenshot.log.includes("has broken! Max combo:"),
    "Showcase unexpectedly eliminated a replay",
  );
  assert.equal(
    [...late.log.matchAll(/has broken! Max combo:/g)].length,
    1,
    "Late preview must preserve eliminations before the start",
  );
  const media = JSON.parse(
    await runCommand("ffprobe", [
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      record.output,
    ]),
  );
  assert.ok(
    media.streams.some(
      (s) => s.codec_type === "video" && s.width === 640 && s.height === 360,
    ),
  );
  await waitUntil(async () => !(await request("/state")).replays.length);
  for (const job of all) {
    await assert.rejects(access(path.join(testDir, "store/jobs", job.id)));
    await assert.rejects(
      access(path.join(root, "runtime/settings/studio", job.id + ".json")),
    );
  }
  assert.equal(
    (await request("/state")).jobs.find((j) => j.id === first.id).retryable,
    false,
  );
  for (const replay of imported.imported)
    await assert.rejects(access(replay.path));
  await access(path.join(fixture.replays, "old.osr"));
  await access(path.join(fixture.replays, "new.osr"));
  // A later batch can reuse identical files; old successful jobs must not collect it.
  assert.equal((await request("/import", "POST", form)).imported.length, 2);
  const repeatPreview = await request("/jobs", "POST", {
    project,
    action: "preview",
  });
  await waitUntil(async () => {
    const s = await request("/state");
    return (
      s.jobs.find((j) => j.id === repeatPreview.id)?.status === "completed"
    );
  });
  assert.equal(
    (await request("/state")).replays.length,
    2,
    "Earlier render consumed a newly uploaded batch",
  );
  await request("/replays", "DELETE");
  assert.equal((await request("/state")).replays.length, 0);
  console.log(
    JSON.stringify(
      {
        ok: true,
        testDir,
        record: record.output,
        screenshot: screenshot.output,
        late: late.output,
        duration: media.format.duration,
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(testDir, "result.json"),
    JSON.stringify(
      {
        ok: true,
        record: record.output,
        screenshot: screenshot.output,
        late: late.output,
      },
      null,
      2,
    ),
  );
} finally {
  server.kill();
  await writeFile(path.join(testDir, "server.log"), serverLog);
}
