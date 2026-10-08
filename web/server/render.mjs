import { spawn } from "node:child_process";
import {
  access,
  mkdir,
  readFile,
  writeFile,
  stat,
  copyFile,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { assignColors } from "../shared/palette.mjs";
import { resolveMap, prepareMapView } from "./lazer.mjs";
import { selectedSkin } from "./assets.mjs";

export function runCommand(exe, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, {
      windowsHide: true,
      ...options,
      timeout: options.timeout ?? 15000,
    });
    let text = "";
    child.stdout.on("data", (b) => (text += b));
    child.stderr.on("data", (b) => (text += b));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(text)
        : reject(
            new Error(
              text.slice(-1500) || `Процесс завершился с кодом ${code}`,
            ),
          ),
    );
  });
}
export const merge = (a, b) => {
  const result = structuredClone(a ?? {});
  for (const [key, value] of Object.entries(b ?? {})) {
    if (["__proto__", "constructor", "prototype"].includes(key))
      throw new Error("Недопустимый ключ настроек");
    result[key] =
      value && typeof value === "object" && !Array.isArray(value)
        ? merge(result[key], value)
        : value;
  }
  return result;
};
export function validateProject(project, store) {
  if (!project || typeof project.name !== "string" || !project.name.trim())
    throw new Error("Укажите название проекта");
  if (
    !["comparison", "replay", "dance", "autoplay", "classic"].includes(
      project.kind,
    )
  )
    throw new Error("Неизвестный сценарий");
  if (
    !Number.isInteger(project.rules?.mode) ||
    project.rules.mode < 0 ||
    project.rules.mode > 4
  )
    throw new Error("Неизвестный режим выбывания");
  if (
    !Number.isInteger(project.rules.minPlayers) ||
    project.rules.minPlayers < 0 ||
    project.rules.minPlayers > 100
  )
    throw new Error("Минимум игроков: 0–100");
  const launch = project.launch ?? {};
  for (const key of [
    "start",
    "end",
    "speed",
    "pitch",
    "offset",
    "cursors",
    "tag",
    "cs",
    "ar",
    "od",
    "hp",
    "screenshotTime",
  ])
    if (launch[key] != null && !Number.isFinite(launch[key]))
      throw new Error(`Некорректный параметр ${key}`);
  for (const key of ["offset", "cursors", "tag"])
    if (launch[key] != null && !Number.isInteger(launch[key]))
      throw new Error(`${key}: требуется целое число`);
  if (
    !Number.isFinite(project.rules.grace) ||
    !["Score", "PP", "Accuracy"].includes(project.rules.sortBy)
  )
    throw new Error("Некорректные правила выбывания");
  if (
    (launch.start ?? 0) < 0 ||
    (launch.end != null && launch.end <= (launch.start ?? 0))
  )
    throw new Error("Конец фрагмента должен быть позже начала");
  if (
    launch.speed <= 0 ||
    launch.pitch <= 0 ||
    launch.cursors < 1 ||
    launch.tag < 1
  )
    throw new Error(
      "Скорость, pitch и число курсоров должны быть положительными",
    );
  if (launch.mods?.trim() && launch.mods2?.trim())
    throw new Error("Используйте либо classic mods, либо mods2");
  if (launch.mods2?.trim()) {
    const mods = JSON.parse(launch.mods2);
    if (!Array.isArray(mods) || mods.some((m) => typeof m.acronym !== "string"))
      throw new Error("mods2 должен быть массивом модов");
  }
  if (
    !Array.isArray(project.replayIds) ||
    new Set(project.replayIds).size !== project.replayIds.length
  )
    throw new Error("Некорректная подборка реплеев");
  const replays = ["comparison", "replay"].includes(project.kind)
    ? project.replayIds.map((id) => store.get("replay", id))
    : [];
  if (replays.some((r) => !r))
    throw new Error("Реплей проекта отсутствует в библиотеке");
  if (["comparison", "replay"].includes(project.kind) && !replays.length)
    throw new Error("Выберите хотя бы один реплей");
  if (project.kind === "replay" && replays.length !== 1)
    throw new Error("Для одиночного режима выберите один реплей");
  if (new Set(replays.map((r) => r.mapHash)).size > 1)
    throw new Error("В одной сцене должны быть реплеи одной карты");
  const map = store.get("map", project.mapHash);
  if (!map)
    throw new Error(
      "Карта не найдена: настройте Songs или lazer и найдите карту по реплею",
    );
  if (replays.some((r) => r.mapHash !== map.hash))
    throw new Error("Выбранные реплеи не соответствуют карте");
  if (
    project.kind === "comparison" &&
    (launch.mods?.trim() || launch.mods2?.trim())
  )
    throw new Error("В сравнении используются исходные моды каждого реплея");
  if (
    !Array.isArray(project.palette?.stops) ||
    project.palette.stops.length < 2 ||
    project.palette.stops.some((c) => !/^#[a-f\d]{6}$/i.test(c))
  )
    throw new Error("Задайте минимум два цвета градиента");
  if (
    !["date", "player", "per-player"].includes(project.palette.mode) ||
    !["rank", "time"].includes(project.palette.spacing)
  )
    throw new Error("Некорректный режим палитры");
  const ex = project.export;
  if (
    !ex ||
    ![ex.width, ex.height, ex.fps].every(Number.isInteger) ||
    ex.width < 64 ||
    ex.height < 64 ||
    ex.width > 30720 ||
    ex.height > 17280 ||
    ex.fps < 1 ||
    ex.fps > 10727
  )
    throw new Error("Некорректные разрешение или FPS");
  if (ex.width % 2 || ex.height % 2)
    throw new Error("Размеры видео должны быть чётными");
  if (!["mp4", "mkv"].includes(ex.container))
    throw new Error("Выберите MP4 или MKV");
  if (!/^[\w-]+$/.test(ex.encoder)) throw new Error("Некорректное имя кодека");
  if (
    !project.configPatch ||
    Array.isArray(project.configPatch) ||
    typeof project.configPatch !== "object"
  )
    throw new Error("Настройки должны быть JSON-объектом");
  if (project.configPatch.Credentials)
    throw new Error("Credentials нельзя хранить в проекте");
  merge({}, project.configPatch);
  return { replays, map };
}

export function buildArguments(
  project,
  settingsName,
  manifestPath,
  replays,
  outputBase,
  action,
) {
  const args = ["-settings", settingsName];
  if (project.launch.noUpdateCheck !== false) args.push("-noupdatecheck");
  if (project.launch.noDbCheck) args.push("-nodbcheck");
  if (project.kind === "comparison")
    args.push("-md5", project.mapHash, "-studio-manifest", manifestPath);
  else if (project.kind === "replay") args.push("-replay", replays[0].path);
  else {
    args.push("-md5", project.mapHash);
    if (project.kind === "classic") args.push("-knockout");
  }
  let mods = project.launch.mods;
  if (
    project.kind === "autoplay" &&
    !project.launch.mods2 &&
    !/AT/i.test(mods || "")
  )
    mods = (mods || "") + "AT";
  if (mods) args.push("-mods", mods);
  if (project.launch.mods2) {
    const mods2 = JSON.parse(project.launch.mods2);
    if (
      project.kind === "autoplay" &&
      !mods2.some((m) => m.acronym.toUpperCase() === "AT")
    )
      mods2.push({ acronym: "AT" });
    args.push("-mods2", JSON.stringify(mods2));
  }
  const fields = [
    "start",
    "end",
    "speed",
    "pitch",
    "offset",
    "cursors",
    "tag",
    "cs",
    "ar",
    "od",
    "hp",
  ];
  for (const field of fields)
    if (project.launch[field] != null)
      args.push(`-${field}`, String(project.launch[field]));
  for (const field of ["skip", "quickstart", "debug", "gldebug"])
    if (project.launch[field]) args.push(`-${field}`);
  if (project.launch.skin) args.push("-skin", project.launch.skin);
  if (action === "screenshot")
    args.push(
      "-ss",
      String(project.launch.screenshotTime ?? project.launch.start ?? 0),
      "-out",
      outputBase,
    );
  else if (action !== "watch")
    args.push("-record", "-preciseprogress", "-out", outputBase);
  return args;
}

export function createRenderer(store, dataDir) {
  let active = null;
  async function removeReplay(id) {
    const replay = store.get("replay", id);
    if (!replay) return;
    const expected = path.join(dataDir, "library", `${id}.osr`);
    if (
      !/^[a-f\d]{64}$/i.test(id) ||
      path.resolve(replay.path) !== path.resolve(expected)
    )
      throw new Error("Нельзя удалить файл за пределами временных реплеев");
    await rm(expected, { force: true });
    store.remove("replay", id);
  }
  async function clearReplays() {
    if (store.list("job").some((j) => ["queued", "running"].includes(j.status)))
      throw new Error("Дождитесь завершения заданий перед очисткой");
    for (const replay of store.list("replay")) await removeReplay(replay.id);
    for (const job of store.list("job"))
      store.put("job", {
        ...job,
        project: null,
        config: null,
        retryable: false,
      });
    return { ok: true };
  }
  async function collectReplays() {
    const jobs = store.list("job"),
      eligible = new Set(
        jobs
          .filter((j) => j.status === "completed" && j.action === "record")
          .flatMap((j) => j.consumedReplayIds ?? []),
      );
    const protectedIds = new Set(
      jobs
        .filter((j) => ["queued", "running"].includes(j.status))
        .flatMap((j) => j.project?.replayIds ?? []),
    );
    for (const id of eligible)
      if (!protectedIds.has(id)) await removeReplay(id);
    for (const old of jobs) {
      const patch = {};
      if (old.consumedReplayIds)
        patch.consumedReplayIds = old.consumedReplayIds.filter((id) =>
          store.get("replay", id),
        );
      if (
        old.project &&
        !["queued", "running"].includes(old.status) &&
        old.project.replayIds.some((id) => !store.get("replay", id))
      )
        Object.assign(patch, { project: null, config: null, retryable: false });
      if (Object.keys(patch).length) store.put("job", { ...old, ...patch });
    }
  }
  for (const job of store.list("job"))
    if (["running", "queued"].includes(job.status))
      store.put("job", {
        ...job,
        status: "interrupted",
        error: "Сервис был остановлен. Запустите задание повторно.",
      });
  async function enqueue(project, action) {
    if (!["record", "preview", "screenshot"].includes(action))
      throw new Error("Неизвестное действие");
    if (project && !["comparison", "replay"].includes(project.kind))
      project = { ...project, replayIds: [] };
    await resolveMap(store, project?.mapHash);
    validateProject(project, store);
    const config = store.get("config", "local");
    if (!config?.enginePath)
      throw new Error("Укажите путь к danser в настройках");
    await access(config.enginePath);
    if (project.kind === "comparison") {
      const probe = await runCommand(config.enginePath, ["-studio-version"]);
      if (!probe.includes("danser-studio-manifest:1"))
        throw new Error(
          "Для закреплённых цветов нужна сборка danser из этого проекта",
        );
    }
    if (["preview", "record"].includes(action))
      await runCommand(config.ffmpegPath || "ffmpeg", ["-version"]);
    // Another completed job may have released these copies during the probes.
    validateProject(project, store);
    const job = {
      id: randomUUID(),
      name: project.name,
      status: "queued",
      progress: 0,
      action,
      createdAt: new Date().toISOString(),
      project: structuredClone(project),
      config: structuredClone(config),
      log: "",
      output: null,
    };
    store.put("job", job);
    void pump();
    return job;
  }
  async function pump() {
    if (active) return;
    const next = store
      .list("job")
      .filter((j) => j.status === "queued")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!next) return;
    active = { id: next.id, child: null, cancelled: false };
    let job = {
      ...next,
      status: "running",
      startedAt: new Date().toISOString(),
    };
    store.put("job", job);
    const save = (patch) => {
      job = { ...job, ...patch };
      store.put("job", job);
    };
    let mapView = null,
      settingsFile = null;
    try {
      const project = structuredClone(job.project),
        config = job.config;
      const { replays, map } = validateProject(project, store);
      mapView = await prepareMapView(store, map, config);
      const skin = await selectedSkin(store, project.launch.skinId);
      if (skin) project.launch.skin = skin.name;
      await Promise.all(replays.map((r) => access(r.path)));
      const jobDir = path.join(dataDir, "jobs", job.id);
      await mkdir(jobDir, { recursive: true });
      const manifestPath = path.join(jobDir, "manifest.json");
      const colors = assignColors(replays, project.palette);
      await writeFile(
        manifestPath,
        JSON.stringify(
          {
            Version: 1,
            Replays: replays.map((r) => ({
              Path: r.path,
              SHA256: r.id,
              Color: colors[r.id],
            })),
          },
          null,
          2,
        ),
      );
      if (job.action === "preview") {
        project.export = {
          ...project.export,
          width: 960,
          height: 540,
          fps: 30,
          encoder: "libx264",
          container: "mp4",
        };
        project.launch.end = Math.min(
          project.launch.end ?? Infinity,
          (project.launch.start ?? 0) + 10,
        );
      }
      const outputDir = config.outputDir || path.join(dataDir, "videos");
      await mkdir(outputDir, { recursive: true });
      const outputBase = `${project.name.replace(/[^\p{L}\p{N}_-]/gu, "_").slice(0, 60)}_${job.id.slice(0, 8)}`;
      const outputFile = path.join(
        outputDir,
        `${outputBase}.${job.action === "screenshot" ? "png" : project.export.container}`,
      );
      let patch = merge(project.configPatch, {
        General: {
          OsuSongsDir: mapView.songsDir,
          OsuReplaysDir: config.replaysDir || path.join(dataDir, "library"),
          ...(config.skinsDir ? { OsuSkinsDir: config.skinsDir } : {}),
        },
        Graphics: { Fullscreen: false },
        Knockout: {
          Mode: project.rules.mode,
          MinPlayers: project.rules.minPlayers,
          GraceEndTime: project.rules.grace,
          RevivePlayersAtEnd: project.rules.revive,
          AddDanser: project.rules.addDanser,
          LiveSort: project.rules.liveSort,
          SortBy: project.rules.sortBy,
        },
        Recording: {
          FrameWidth: project.export.width,
          FrameHeight: project.export.height,
          FPS: project.export.fps,
          Encoder: project.export.encoder,
          Container: project.export.container,
          OutputDir: outputDir,
        },
      });
      if (job.action === "preview")
        patch = merge(patch, {
          Playfield: {
            LeadInTime: 0,
            LeadInHold: 0,
            FadeOutTime: 0,
            SeizureWarning: { Enabled: false },
          },
        });
      if (skin)
        patch = merge(patch, {
          General: { OsuSkinsDir: skin.directory },
          Skin: { CurrentSkin: skin.name },
        });
      else if (project.launch.skinId === "")
        patch = merge(patch, { Skin: { CurrentSkin: "default" } });
      if (project.kind === "comparison" && project.palette.fixed !== false)
        patch = merge(patch, {
          Cursor: { Colors: { EnableRainbow: false, FlashToTheBeat: false } },
        });
      const configDir = path.join(
        path.dirname(config.enginePath),
        "settings",
        "studio",
      );
      await mkdir(configDir, { recursive: true });
      const settingsName = `studio/${job.id}`;
      settingsFile = path.join(configDir, `${job.id}.json`);
      await writeFile(settingsFile, JSON.stringify(patch, null, 2));
      await writeFile(
        path.join(jobDir, "project.json"),
        JSON.stringify({ project, config, colors }, null, 2),
      );
      const args = buildArguments(
        project,
        settingsName,
        manifestPath,
        replays,
        outputBase,
        job.action,
      );
      if (map.source === "lazer" || map.source === "manual") {
        const skip = args.indexOf("-nodbcheck");
        if (skip >= 0) args.splice(skip, 1);
      }
      save({ args, output: outputFile, log: "Запуск danser…\n" });
      const engineEnv = { ...process.env };
      engineEnv.DANSER_STUDIO_FFMPEG = config.ffmpegPath || "ffmpeg";
      if (config.ffmpegPath && path.isAbsolute(config.ffmpegPath))
        engineEnv.PATH = `${path.dirname(config.ffmpegPath)}${path.delimiter}${engineEnv.PATH}`;
      await new Promise((resolve, reject) => {
        if (active.cancelled) return reject(new Error("Отменено"));
        const child = spawn(config.enginePath, args, {
          cwd: path.dirname(config.enginePath),
          windowsHide: true,
          env: engineEnv,
        });
        active.child = child;
        const log = (buffer) => {
          const chunk = buffer.toString();
          const matches = [...chunk.matchAll(/Progress:\s*(\d+)%/g)];
          save({
            log: (job.log + chunk).slice(-60000),
            ...(matches.length
              ? { progress: Math.min(99, Number(matches.at(-1)[1])) }
              : {}),
          });
        };
        child.stdout.on("data", log);
        child.stderr.on("data", log);
        child.once("error", reject);
        child.once("close", (code) =>
          code === 0
            ? resolve()
            : reject(
                new Error(
                  `danser завершился с кодом ${code}. Подробности в журнале.`,
                ),
              ),
        );
      });
      if (active.cancelled) throw new Error("Отменено");
      if (job.log.includes("Beatmap not found, closing"))
        throw new Error(
          "Движок не нашёл точную карту из реплея. Проверьте источник карты или импортируйте нужную версию .osz.",
        );
      // Danser stores screenshots in DataDir/screenshots, regardless of Recording.OutputDir.
      if (job.action === "screenshot")
        await copyFile(
          path.join(
            path.dirname(config.enginePath),
            "screenshots",
            outputBase + ".png",
          ),
          outputFile,
        );
      if (job.action !== "watch") {
        let info;
        try {
          info = await stat(outputFile);
        } catch (error) {
          if (error.code === "ENOENT")
            throw new Error(
              "Движок завершился без создания видео или снимка. Подробности — в журнале задания.",
            );
          throw error;
        }
        if (info.size < 32)
          throw new Error("Движок не создал корректный выходной файл");
        if (job.action !== "screenshot") {
          const ffprobe =
            config.ffmpegPath && path.isAbsolute(config.ffmpegPath)
              ? path.join(
                  path.dirname(config.ffmpegPath),
                  process.platform === "win32" ? "ffprobe.exe" : "ffprobe",
                )
              : "ffprobe";
          const meta = JSON.parse(
            await runCommand(ffprobe, [
              "-v",
              "error",
              "-show_streams",
              "-show_format",
              "-of",
              "json",
              outputFile,
            ]),
          );
          if (
            !meta.streams?.some((s) => s.codec_type === "video") ||
            Number(meta.format?.duration) <= 0
          )
            throw new Error("Выходное видео не прошло проверку");
          save({
            media: { duration: Number(meta.format.duration), size: info.size },
          });
        } else if (
          !(await readFile(outputFile))
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        )
          throw new Error("Некорректный PNG");
      }
      save({
        status: "completed",
        progress: 100,
        finishedAt: new Date().toISOString(),
        ...(job.action === "record"
          ? {
              consumedReplayIds: replays.map((r) => r.id),
              project: null,
              config: null,
              retryable: false,
            }
          : { retryable: true }),
      });
    } catch (error) {
      save({
        status: active.cancelled ? "cancelled" : "failed",
        error: error.message,
        finishedAt: new Date().toISOString(),
      });
    } finally {
      try {
        if (mapView) await mapView.cleanup();
        if (settingsFile) await rm(settingsFile, { force: true });
        await rm(path.join(dataDir, "jobs", job.id), {
          recursive: true,
          force: true,
        });
        await collectReplays();
      } catch (e) {
        const latest = store.get("job", job.id);
        store.put("job", {
          ...latest,
          log: latest.log + "\nНе удалось завершить очистку: " + e.message,
        });
      }
      active = null;
      void pump();
    }
  }
  function cancel(id) {
    const job = store.get("job", id);
    if (!job) throw new Error("Задание не найдено");
    if (active?.id === id) {
      active.cancelled = true;
      if (active.child?.pid) {
        if (process.platform === "win32")
          spawn("taskkill", ["/PID", String(active.child.pid), "/T", "/F"], {
            windowsHide: true,
          });
        else active.child.kill("SIGTERM");
      }
    } else if (job.status === "queued")
      store.put("job", {
        ...job,
        status: "cancelled",
        finishedAt: new Date().toISOString(),
      });
    else throw new Error("Это задание уже завершено");
    return store.get("job", id);
  }
  return { enqueue, cancel, clearReplays, isActive: () => Boolean(active) };
}
