import yauzl from "yauzl";
import {
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  access,
  stat,
} from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { safeResourceName } from "./lazer.mjs";
import { scanMaps } from "./maps.mjs";
const imports = new Map();
async function importOnce(root, action) {
  if (!imports.has(root))
    imports.set(
      root,
      action().finally(() => imports.delete(root)),
    );
  return imports.get(root);
}

// Extract into a newly created managed directory, never into the user's source.
export async function extractArchive(buffer, destination) {
  const zip = await new Promise((resolve, reject) =>
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true },
      (e, z) => (e ? reject(e) : resolve(z)),
    ),
  );
  await mkdir(destination, { recursive: true });
  let count = 0,
    total = 0;
  const names = new Set();
  try {
    await new Promise((resolve, reject) => {
      zip.on("error", reject);
      zip.on("end", resolve);
      zip.on("entry", (entry) => {
        void (async () => {
          if (
            ++count > 20000 ||
            (total += entry.uncompressedSize) > 1024 * 1024 * 1024
          )
            throw new Error(
              "Архив слишком большой: максимум 20 000 файлов и 1 ГБ после распаковки",
            );
          if (entry.generalPurposeBitFlag & 1)
            throw new Error("Зашифрованные архивы не поддерживаются");
          const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
          if (mode === 0xa000)
            throw new Error("Ссылки внутри архива не поддерживаются");
          const directory = entry.fileName.endsWith("/");
          const name = safeResourceName(
              directory ? entry.fileName.slice(0, -1) : entry.fileName,
            ),
            key = name.toLowerCase();
          if (names.has(key))
            throw new Error("Повторяющееся имя файла в архиве");
          names.add(key);
          const target = path.join(destination, ...name.split("/"));
          if (directory) await mkdir(target, { recursive: true });
          else {
            await mkdir(path.dirname(target), { recursive: true });
            const input = await new Promise((r, j) =>
              zip.openReadStream(entry, (e, s) => (e ? j(e) : r(s))),
            );
            await pipeline(input, createWriteStream(target, { flags: "wx" }));
          }
          zip.readEntry();
        })().catch(reject);
      });
      zip.readEntry();
    });
  } catch (e) {
    zip.close();
    await rm(destination, { recursive: true, force: true });
    throw e;
  }
}

export async function importMapArchive(store, dataDir, buffer, name) {
  if (!name.toLowerCase().endsWith(".osz"))
    throw new Error("Импортируйте набор карты .osz с музыкой и ресурсами");
  const id = createHash("sha256").update(buffer).digest("hex"),
    root = path.join(dataDir, "maps", id);
  await importOnce(root, async () => {
    try {
      await access(root);
    } catch {
      await extractArchive(buffer, root);
    }
  });
  const result = await scanMaps(root);
  if (!result.maps.length) throw new Error("В архиве нет карт osu!standard");
  for (const map of result.maps) store.put("map", { ...map, source: "manual" });
  return result;
}

export async function importSkin(dataDir, buffer, name) {
  if (!name.toLowerCase().endsWith(".osk"))
    throw new Error("Ожидается скин .osk");
  const id = createHash("sha256").update(buffer).digest("hex"),
    root = path.join(dataDir, "skins", id);
  await importOnce(root, async () => {
    try {
      await access(path.join(root, ".studio-name"));
    } catch {
      await extractArchive(buffer, root);
      await writeFile(
        path.join(root, ".studio-name"),
        path.basename(name, path.extname(name)),
        "utf8",
      );
    }
  });
  return { id, label: path.basename(name, ".osk"), root };
}

export async function listSkins(store, dataDir) {
  const skins = [];
  const managed = path.join(dataDir, "skins");
  await mkdir(managed, { recursive: true });
  for (const entry of await readdir(managed, { withFileTypes: true }))
    if (entry.isDirectory()) {
      const root = path.join(managed, entry.name);
      try {
        skins.push({
          id: entry.name,
          label: await readFile(path.join(root, ".studio-name"), "utf8"),
          root,
        });
      } catch {}
    }
  const local = store.get("config", "local")?.skinsDir;
  if (local)
    for (const entry of await readdir(local, { withFileTypes: true })) {
      const root = path.join(local, entry.name);
      if (entry.isDirectory())
        skins.push({
          id: createHash("sha256").update(root).digest("hex"),
          label: entry.name,
          root,
        });
      else if (entry.name.toLowerCase().endsWith(".osk")) {
        if ((await stat(root)).size > 256 * 1024 * 1024)
          throw new Error(`Скин ${entry.name} превышает 256 МБ`);
        skins.push({
          ...(await importSkin(dataDir, await readFile(root), entry.name)),
        });
      }
    }
  for (const skin of skins) store.put("skin", skin);
  return [
    ...new Map(skins.map(({ root, ...skin }) => [skin.id, skin])).values(),
  ].sort((a, b) => a.label.localeCompare(b.label));
}

export async function selectedSkin(store, id) {
  if (!id) return null;
  const skin = store.get("skin", id);
  if (!skin) throw new Error("Скин не найден. Обновите список скинов");
  await access(skin.root);
  return { directory: path.dirname(skin.root), name: path.basename(skin.root) };
}
