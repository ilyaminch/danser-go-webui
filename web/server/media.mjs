import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { safeResourceName, storageFile } from "./lazer.mjs";

// Read filenames from the actual .osu, including indexes made before media support.
export function parseMedia(text) {
  let section = "",
    audio = "",
    background = "",
    previewTime = -1;
  for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("[")) {
      section = line;
      continue;
    }
    if (section === "[General]" && line.startsWith("AudioFilename:"))
      audio = line.slice("AudioFilename:".length).trim();
    if (section === "[General]" && line.startsWith("PreviewTime:")) {
      const value = line.slice("PreviewTime:".length).trim();
      const parsed = /^\d+$/.test(value) ? Number(value) : -1;
      previewTime = Number.isSafeInteger(parsed) ? parsed : -1;
    }
    if (section === "[Events]" && !background) {
      const match = /^(?:0|Background)\s*,\s*\d+\s*,\s*"([^"]+)"/i.exec(line);
      if (match) background = match[1];
    }
  }
  return { audio, background, previewTime };
}

export async function resolveMedia(store, map, kind) {
  if (!["audio", "background"].includes(kind))
    throw new Error("Unknown media type");
  const names = parseMedia(await readFile(map.path, "utf8"));
  if (!names[kind]) return null;
  const name = safeResourceName(names[kind]);
  let file, root;
  if (map.source === "lazer") {
    const set = store.get("lazer-set", map.setKey);
    if (!set || path.resolve(set.root) !== path.resolve(map.sourceRoot))
      throw new Error("Map resources are missing; refresh the lazer index");
    const relative = path.posix.join(
      path.posix.dirname(map.filename.replaceAll("\\", "/")),
      name,
    );
    const resource = set.files.find(
      (f) =>
        f.name.replaceAll("\\", "/").toLowerCase() === relative.toLowerCase(),
    );
    if (!resource) return null;
    root = await realpath(path.join(map.sourceRoot, "files"));
    file = await realpath(storageFile(map.sourceRoot, resource.sha256));
  } else {
    root = await realpath(path.dirname(map.path));
    file = await realpath(path.join(root, ...name.split("/"))).catch((e) => {
      if (e.code === "ENOENT") return null;
      throw e;
    });
    if (!file) return null;
  }
  const relative = path.relative(root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("Resource escapes its map directory");
  if (!(await stat(file)).isFile()) return null;
  return { path: file, name };
}
