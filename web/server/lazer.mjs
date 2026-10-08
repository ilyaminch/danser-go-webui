import { spawn } from "node:child_process";
import {
  access,
  readFile,
  mkdir,
  mkdtemp,
  link,
  symlink,
  rm,
  realpath,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseMap, scanMaps } from "./maps.mjs";

const helper = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../runtime/lazer-index/LazerIndex.exe",
);
const tempRoot = path.join(tmpdir(), "danser-studio");
const caches = new WeakMap();
function cacheFor(store) {
  if (!caches.has(store))
    caches.set(store, { scans: new Map(), fingerprints: new Map() });
  return caches.get(store);
}
export async function detectLazer() {
  const root =
    process.platform === "win32"
      ? path.join(process.env.APPDATA || "", "osu")
      : path.join(process.env.HOME || "", ".local/share/osu");
  try {
    await access(path.join(root, "client.realm"));
    await access(path.join(root, "files"));
    return root;
  } catch {
    return null;
  }
}
export function storageFile(root, hash) {
  if (!/^[a-f\d]{64}$/i.test(hash))
    throw new Error("Некорректный SHA-256 в индексе lazer");
  return path.join(root, "files", hash[0], hash.slice(0, 2), hash);
}
export function safeResourceName(name) {
  const normalized = String(name).replaceAll("\\", "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized
      .split("/")
      .some(
        (p) =>
          !p ||
          p === "." ||
          p === ".." ||
          /[<>:"|?*\x00-\x1f]/.test(p) ||
          /[. ]$/.test(p) ||
          /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(p),
      )
  )
    throw new Error(`Недопустимое имя ресурса lazer: ${name}`);
  return normalized;
}
export async function readLazerIndex(root) {
  if (!root || !path.isAbsolute(root))
    throw new Error("Укажите корневую папку lazer с client.realm и files");
  await access(path.join(root, "client.realm"));
  await access(path.join(root, "files"));
  try {
    await access(helper);
  } catch {
    throw new Error("Сначала соберите модуль lazer: Build-LazerIndex.ps1");
  }
  return new Promise((resolve, reject) => {
    const child = spawn(helper, [path.join(root, "client.realm")], {
      windowsHide: true,
      timeout: 120000,
    });
    let output = "",
      errors = "";
    child.stdout.on("data", (b) => {
      output += b;
      if (output.length > 64 * 1024 * 1024) {
        child.kill();
        reject(new Error("Индекс lazer слишком большой"));
      }
    });
    child.stderr.on("data", (b) => (errors = (errors + b).slice(-3000)));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0)
        return reject(
          new Error(errors || "Чтение индекса lazer не завершилось"),
        );
      try {
        resolve(JSON.parse(output));
      } catch (e) {
        reject(e);
      }
    });
  });
}
export async function indexLazer(store, root, raw) {
  root = path.resolve(root);
  const stamp = await stat(path.join(root, "client.realm"));
  raw ??= await readLazerIndex(root);
  const maps = [],
    errors = [],
    sets = new Map();
  for (const item of raw.maps) {
    try {
      const files = raw.sets[item.setKey];
      if (!Array.isArray(files)) throw new Error("Ресурсы набора не найдены");
      const osu = files.find(
        (f) =>
          f.sha256 === item.sha256 && f.name.toLowerCase().endsWith(".osu"),
      );
      if (!osu) throw new Error("Исходный .osu не найден");
      safeResourceName(osu.name);
      const absolute = storageFile(root, item.sha256),
        map = parseMap(await readFile(absolute), absolute);
      if (!map) continue;
      if (map.hash !== item.hash.toLowerCase())
        throw new Error("MD5 файла отличается от индекса");
      sets.set(item.setKey, files);
      maps.push({
        ...map,
        source: "lazer",
        sourceRoot: path.resolve(root),
        setKey: item.setKey,
        filename: osu.name,
        sha256: item.sha256,
      });
    } catch (e) {
      errors.push(`${item.hash}: ${e.message}`);
    }
  }
  // Only replace a source after it was successfully read; other Songs sources are retained.
  for (const old of store.list("map"))
    if (old.source === "lazer") store.remove("map", old.id);
  for (const old of store.list("lazer-set")) store.remove("lazer-set", old.id);
  for (const [id, files] of sets)
    store.put("lazer-set", { id, root: path.resolve(root), files });
  for (const map of maps)
    if (store.get("map", map.id)?.source !== "songs") store.put("map", map);
  cacheFor(store).fingerprints.set(root, `${stamp.mtimeMs}:${stamp.size}`);
  return { maps, errors };
}
export async function resolveMap(store, hash) {
  if (!/^[a-f\d]{32}$/i.test(hash)) throw new Error("Некорректный MD5 карты");
  let map = store.get("map", hash.toLowerCase());
  const songs = store.get("config", "local")?.songsDir;
  if (!map && songs) {
    const { scans } = cacheFor(store),
      key = `songs:${path.resolve(songs)}`;
    if (!scans.has(key))
      scans.set(
        key,
        scanMaps(songs)
          .then((result) => {
            for (const item of result.maps) store.put("map", item);
          })
          .finally(() => scans.delete(key)),
      );
    await scans.get(key);
    map = store.get("map", hash.toLowerCase());
  }
  if (!map && store.get("config", "local")?.lazerDir) {
    const { scans, fingerprints } = cacheFor(store);
    const root = path.resolve(store.get("config", "local").lazerDir),
      stamp = await stat(path.join(root, "client.realm")),
      fingerprint = `${stamp.mtimeMs}:${stamp.size}`;
    if (fingerprints.get(root) !== fingerprint) {
      if (!scans.has(root))
        scans.set(
          root,
          indexLazer(store, root).finally(() => scans.delete(root)),
        );
      await scans.get(root);
    }
    map = store.get("map", hash.toLowerCase());
  }
  if (!map)
    throw new Error(
      "Точная версия карты из реплея не найдена в Songs или lazer. Обновите индекс либо установите эту версию карты.",
    );
  return map;
}
export async function prepareMapView(store, map, config) {
  if (map.source !== "lazer")
    return {
      songsDir: map.sourceRoot || config.songsDir,
      cleanup: async () => {},
    };
  const set = store.get("lazer-set", map.setKey);
  if (
    !set ||
    set.root !== map.sourceRoot ||
    map.sourceRoot !== path.resolve(config.lazerDir || "")
  )
    throw new Error("Источник lazer изменился. Обновите индекс карт.");
  // A fresh view exists only for this job. Files are links, never fallback copies.
  await mkdir(tempRoot, { recursive: true });
  const view = await mkdtemp(path.join(tempRoot, "maps-"));
  const cleanup = async () => {
    const relative = path.relative(tempRoot, view);
    if (
      !relative ||
      relative.startsWith("..") ||
      path.isAbsolute(relative) ||
      !path.basename(view).startsWith("maps-")
    )
      throw new Error("Некорректная временная папка");
    await rm(view, { recursive: true, force: true });
  };
  try {
    const allowedRoot = await realpath(path.join(map.sourceRoot, "files")),
      seen = new Set();
    for (const file of set.files) {
      if (
        file.name.toLowerCase().endsWith(".osu") &&
        file.sha256 !== map.sha256
      )
        continue;
      const name = safeResourceName(file.name),
        key = name.toLowerCase();
      if (seen.has(key)) throw new Error("Повторяющееся имя ресурса lazer");
      seen.add(key);
      const source = await realpath(storageFile(map.sourceRoot, file.sha256)),
        relative = path.relative(allowedRoot, source);
      if (relative.startsWith("..") || path.isAbsolute(relative))
        throw new Error("Ресурс выходит за пределы хранилища lazer");
      const target = path.join(view, "map", ...name.split("/"));
      await mkdir(path.dirname(target), { recursive: true });
      try {
        await link(source, target);
      } catch (e) {
        if (e.code !== "EXDEV") throw e;
        try {
          await symlink(source, target, "file");
        } catch {
          throw new Error(
            "Нельзя создать ссылки между дисками. Разрешите символические ссылки в Windows или задайте TEMP на диск хранилища lazer. Копирование файлов отключено.",
          );
        }
      }
    }
    const actual = parseMap(
      await readFile(
        path.join(view, "map", ...safeResourceName(map.filename).split("/")),
      ),
      map.path,
    );
    if (actual?.hash !== map.hash)
      throw new Error("Файл карты изменился. Обновите индекс lazer.");
    return { songsDir: view, cleanup };
  } catch (e) {
    await cleanup();
    throw e;
  }
}
