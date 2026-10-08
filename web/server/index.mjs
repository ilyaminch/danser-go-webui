import express from "express";
import multer from "multer";
import { mkdir, readFile, writeFile, readdir, access } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openStore } from "./store.mjs";
import { parseSafely } from "./parse-worker.mjs";
import { scanMaps } from "./maps.mjs";
import { detectLazer, indexLazer, resolveMap } from "./lazer.mjs";
import { loadSchema } from "./schema.mjs";
import { createRenderer, validateProject, runCommand } from "./render.mjs";
import { importMapArchive, importSkin, listSkins } from "./assets.mjs";
import { resolveMedia } from "./media.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.STUDIO_DATA_DIR || path.join(root, "data");
const port = Number(process.env.PORT || 3000);
const store = openStore(dataDir),
  renderer = createRenderer(store, dataDir),
  app = express();
await mkdir(path.join(dataDir, "library"), { recursive: true });
if (!store.get("config", "local"))
  store.put("config", {
    id: "local",
    enginePath: "",
    songsDir: "",
    skinsDir: "",
    replaysDir: "",
    outputDir: path.join(dataDir, "videos"),
    ffmpegPath: "ffmpeg",
  });
const bundledEngine = path.resolve(root, "../runtime/danser-studio.exe");
const localConfig = store.get("config", "local");
if (!localConfig.bundledEngineInitialized && existsSync(bundledEngine))
  store.put("config", {
    ...localConfig,
    enginePath: localConfig.enginePath || bundledEngine,
    bundledEngineInitialized: true,
  });
app.disable("x-powered-by");
app.use((req, res, next) => {
  const expected = `http://127.0.0.1:${port}`,
    host = req.get("host"),
    origin = req.get("origin");
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`)
    return res.status(403).json({ error: "Недопустимый адрес сервиса" });
  if (origin && origin !== expected && origin !== `http://localhost:${port}`)
    return res.status(403).json({ error: "Недопустимый источник запроса" });
  if (
    req.path.startsWith("/api/") &&
    req.method !== "GET" &&
    req.get("x-studio-client") !== "1"
  )
    return res
      .status(403)
      .json({ error: "Запрос должен поступать из Danser Studio" });
  next();
});
app.use(express.json({ limit: "5mb" }));
app.use((req, res, next) => {
  if (Number(req.get("content-length")) > 256 * 1024 * 1024)
    return res
      .status(413)
      .json({ error: "Импортируйте не более 256 МБ за один раз" });
  next();
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 200 },
});
const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res)).catch(next);
app.get("/api/state", (req, res) =>
  res.json({
    replays: store.list("replay"),
    maps: store.list("map"),
    jobs: store.list("job").map(({ config, project, ...job }) => job),
    config: store.get("config", "local"),
  }),
);
app.get(
  "/api/maps/:hash/media",
  asyncRoute(async (req, res) => {
    const map = store.get("map", req.params.hash);
    if (!map) return res.status(404).json({ error: "Map not found" });
    const [background, audio] = await Promise.all(
      ["background", "audio"].map((kind) =>
        resolveMedia(store, map, kind).catch(() => null),
      ),
    );
    const base = `/api/maps/${map.hash}/media/`;
    res.json({
      background: background ? base + "background" : null,
      audio: audio ? base + "audio" : null,
    });
  }),
);
app.get(
  "/api/maps/:hash/media/:kind",
  asyncRoute(async (req, res) => {
    const map = store.get("map", req.params.hash);
    if (!map || !["background", "audio"].includes(req.params.kind))
      return res.sendStatus(404);
    const resource = await resolveMedia(store, map, req.params.kind);
    if (!resource) return res.sendStatus(404);
    const ext = path.extname(resource.name).toLowerCase();
    const types = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".mp3": "audio/mpeg",
      ".ogg": "audio/ogg",
      ".wav": "audio/wav",
      ".flac": "audio/flac",
    };
    if (
      !types[ext] ||
      !(req.params.kind === "audio"
        ? types[ext].startsWith("audio/")
        : types[ext].startsWith("image/"))
    )
      return res.sendStatus(415);
    res
      .type(types[ext])
      .set("Cache-Control", "private, no-cache")
      .sendFile(resource.path);
  }),
);
app.get(
  "/api/schema",
  asyncRoute(async (req, res) =>
    res.json(await loadSchema(path.resolve(root, "../danser-go"))),
  ),
);
app.get(
  "/api/health",
  asyncRoute(async (req, res) => {
    const config = store.get("config", "local"),
      result = {
        node: process.version,
        engine: false,
        studio: false,
        ffmpeg: false,
        songs: false,
        lazer: false,
      };
    if (config.enginePath) {
      try {
        await access(config.enginePath);
        result.engine = true;
        result.studio = (
          await runCommand(config.enginePath, ["-studio-version"])
        ).includes("danser-studio-manifest:1");
      } catch (e) {
        result.engineError = e.message;
      }
    }
    try {
      await runCommand(config.ffmpegPath || "ffmpeg", ["-version"]);
      result.ffmpeg = true;
    } catch (e) {
      result.ffmpegError = e.message;
    }
    try {
      if (config.songsDir) {
        await access(config.songsDir);
        result.songs = true;
      }
    } catch {}
    try {
      if (config.lazerDir) {
        await access(path.join(config.lazerDir, "client.realm"));
        await access(path.join(config.lazerDir, "files"));
        result.lazer = true;
      }
    } catch {}
    res.json(result);
  }),
);
app.put(
  "/api/config",
  asyncRoute(async (req, res) => {
    const config = { ...store.get("config", "local"), id: "local" };
    for (const key of [
      "enginePath",
      "songsDir",
      "lazerDir",
      "skinsDir",
      "replaysDir",
      "outputDir",
      "ffmpegPath",
    ]) {
      const value = String(req.body[key] ?? "").trim();
      if (value && key !== "ffmpegPath" && !path.isAbsolute(value))
        throw new Error(`${key}: укажите абсолютный путь`);
      config[key] = value;
    }
    res.json(store.put("config", config));
  }),
);
async function importFiles(files) {
  const imported = [],
    duplicates = [],
    errors = [],
    hashes = new Set(),
    parsed = [];
  for (const file of files) {
    try {
      if (!file.name.toLowerCase().endsWith(".osr"))
        throw new Error("Ожидается файл .osr");
      const replay = await parseSafely(file.buffer, file.name);
      hashes.add(replay.mapHash);
      parsed.push({ file, replay });
    } catch (e) {
      errors.push({ file: file.name, error: e.message });
    }
  }
  if (hashes.size > 1)
    throw new Error(
      "Загрузка отклонена: реплеи относятся к разным картам. Загрузите попытки только одной карты.",
    );
  const retained = store.list("replay");
  if (
    parsed.length &&
    retained.some((r) => r.mapHash !== parsed[0].replay.mapHash)
  )
    throw new Error(
      "Сначала завершите текущий рендер или очистите его реплеи. Для одного видео нужна одна карта.",
    );
  if (errors.length) return { imported, duplicates, errors, mapErrors: [] };
  for (const { file, replay } of parsed) {
    if (store.get("replay", replay.id)) {
      duplicates.push(file.name);
      continue;
    }
    const destination = path.join(dataDir, "library", `${replay.id}.osr`);
    await writeFile(destination, file.buffer);
    replay.path = destination;
    store.put("replay", replay);
    imported.push(replay);
  }
  const mapErrors = [];
  for (const hash of hashes) {
    try {
      await resolveMap(store, hash);
    } catch (e) {
      mapErrors.push({ hash, error: e.message });
    }
  }
  return { imported, duplicates, errors, mapErrors };
}
app.post(
  "/api/import",
  upload.array("files"),
  asyncRoute(async (req, res) =>
    res.json(
      await importFiles(
        (req.files ?? []).map((f) => ({
          name: f.originalname,
          buffer: f.buffer,
        })),
      ),
    ),
  ),
);
app.post(
  "/api/import-folder",
  asyncRoute(async (req, res) => {
    const dir = String(req.body.path ?? "");
    if (!path.isAbsolute(dir))
      throw new Error("Укажите абсолютный путь к папке");
    const files = [];
    async function walk(current, depth = 0) {
      if (depth > 5) return;
      for (const entry of await readdir(current, { withFileTypes: true })) {
        const target = path.join(current, entry.name);
        if (entry.isDirectory()) await walk(target, depth + 1);
        else if (entry.name.toLowerCase().endsWith(".osr")) {
          if (files.length >= 1000)
            throw new Error("Импортируйте не более 1000 реплеев за один раз");
          const buffer = await readFile(target);
          if (buffer.length > 20 * 1024 * 1024) continue;
          files.push({ name: entry.name, buffer });
        }
      }
    }
    await walk(dir);
    res.json(await importFiles(files));
  }),
);
app.patch("/api/replays/:id", (req, res, next) => {
  const replay = store.get("replay", req.params.id);
  if (!replay) return next(new Error("Реплей не найден"));
  replay.group = String(req.body.group ?? "").slice(0, 100);
  res.json(store.put("replay", replay));
});
app.post(
  "/api/maps/scan",
  asyncRoute(async (req, res) => {
    const config = store.get("config", "local");
    if (!config.songsDir && !config.lazerDir)
      throw new Error("Сначала укажите Songs или хранилище lazer");
    const result = { maps: [], errors: [] };
    if (config.songsDir) {
      const scanned = await scanMaps(config.songsDir);
      if (scanned.errors.length && !scanned.maps.length)
        throw new Error(scanned.errors[0]);
      for (const old of store.list("map"))
        if (old.source === "songs") store.remove("map", old.id);
      for (const map of scanned.maps) store.put("map", map);
      result.errors.push(...scanned.errors);
    }
    if (config.lazerDir) {
      const scanned = await indexLazer(store, config.lazerDir);
      result.errors.push(...scanned.errors);
    }
    result.maps = store.list("map");
    res.json(result);
  }),
);
app.get(
  "/api/lazer/detect",
  asyncRoute(async (req, res) => res.json({ path: await detectLazer() })),
);
app.post(
  "/api/maps/resolve",
  asyncRoute(async (req, res) =>
    res.json(await resolveMap(store, String(req.body.hash ?? ""))),
  ),
);
const assetsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 256 * 1024 * 1024, files: 1 },
});
app.post(
  "/api/maps/import",
  assetsUpload.single("file"),
  asyncRoute(async (req, res) => {
    if (!req.file) throw new Error("Выберите .osz");
    res.json(
      await importMapArchive(
        store,
        dataDir,
        req.file.buffer,
        req.file.originalname,
      ),
    );
  }),
);
app.get(
  "/api/skins",
  asyncRoute(async (req, res) => res.json(await listSkins(store, dataDir))),
);
app.post(
  "/api/skins/import",
  assetsUpload.single("file"),
  asyncRoute(async (req, res) => {
    if (!req.file) throw new Error("Выберите .osk");
    res.json(await importSkin(dataDir, req.file.buffer, req.file.originalname));
  }),
);
app.delete(
  "/api/replays",
  asyncRoute(async (req, res) => res.json(await renderer.clearReplays())),
);
app.post("/api/render/validate", (req, res, next) => {
  try {
    const { replays, map } = validateProject(req.body, store);
    res.json({ ok: true, count: replays.length, map });
  } catch (e) {
    next(e);
  }
});
app.post(
  "/api/jobs",
  asyncRoute(async (req, res) =>
    res.json(await renderer.enqueue(req.body.project, req.body.action)),
  ),
);
app.post("/api/jobs/:id/cancel", (req, res, next) => {
  try {
    res.json(renderer.cancel(req.params.id));
  } catch (e) {
    next(e);
  }
});
app.post(
  "/api/jobs/:id/retry",
  asyncRoute(async (req, res) => {
    const job = store.get("job", req.params.id);
    if (!job?.project)
      throw new Error(
        "Реплеи этого видео уже очищены. Загрузите новые попытки.",
      );
    res.json(await renderer.enqueue(job.project, job.action));
  }),
);
app.get("/api/jobs/:id/output", (req, res, next) => {
  const job = store.get("job", req.params.id);
  if (
    !job ||
    job.status !== "completed" ||
    !job.output ||
    job.action === "watch"
  )
    return res.status(404).json({ error: "Результат ещё не готов" });
  if (req.query.download) res.download(job.output);
  else
    res.sendFile(job.output, (err) => {
      if (err) next(err);
    });
});
async function credentialsPath() {
  const config = store.get("config", "local");
  if (!config.enginePath) throw new Error("Сначала подключите движок");
  const dir = path.join(path.dirname(config.enginePath), "settings");
  await mkdir(dir, { recursive: true });
  return path.join(dir, "credentials.json");
}
async function readCredentials() {
  try {
    return JSON.parse(await readFile(await credentialsPath(), "utf8"));
  } catch (e) {
    if (e.code === "ENOENT")
      return {
        ClientId: "",
        ClientSecret: "",
        AuthType: "ClientCredentials",
        CallbackPort: 8294,
      };
    throw e;
  }
}
app.get(
  "/api/credentials",
  asyncRoute(async (req, res) => {
    const c = await readCredentials();
    res.json({
      ClientId: c.ClientId,
      AuthType: c.AuthType,
      CallbackPort: c.CallbackPort,
      hasSecret: !!c.ClientSecret,
      hasToken: !!c.AccessToken,
    });
  }),
);
app.put(
  "/api/credentials",
  asyncRoute(async (req, res) => {
    if (renderer.isActive())
      throw new Error(
        "Дождитесь завершения рендера перед изменением авторизации",
      );
    const input = req.body;
    if (
      !["ClientCredentials", "AuthorizationCode"].includes(input.AuthType) ||
      !Number.isInteger(input.CallbackPort) ||
      input.CallbackPort < 1 ||
      input.CallbackPort > 65535
    )
      throw new Error("Некорректный тип авторизации или callback port");
    const c = await readCredentials();
    c.ClientId = String(input.ClientId ?? "");
    c.AuthType = input.AuthType;
    c.CallbackPort = input.CallbackPort;
    if (typeof input.ClientSecret === "string" && input.ClientSecret)
      c.ClientSecret = input.ClientSecret;
    if (input.clearToken) {
      delete c.AccessToken;
      delete c.RefreshToken;
      delete c.Expiry;
    }
    await writeFile(await credentialsPath(), JSON.stringify(c, null, 2));
    res.json({ ok: true });
  }),
);
app.use((error, req, res, next) => {
  console.error(error.message);
  if (!res.headersSent)
    res.status(400).json({ error: error.message || "Ошибка запроса" });
});
if (process.argv.includes("--dev")) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: {
      middlewareMode: true,
      watch: { ignored: ["**/data/**", "**/.local-work/**"] },
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (req, res) =>
    res.sendFile(path.join(root, "dist/index.html")),
  );
}
app.listen(port, "127.0.0.1", () =>
  console.log(`Danser Studio: http://127.0.0.1:${port}`),
);
