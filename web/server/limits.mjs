import { open } from "node:fs/promises";

export const MiB = 1024 * 1024;
export const IMPORT_BYTES = 256 * MiB;
export const REPLAY_BYTES = 20 * MiB;
export const IMPORT_FILES = 200;
export const MAP_BYTES = 8 * MiB;
export const MAP_LINE_BYTES = 64 * 1024;
export const DECODED_REPLAY_BYTES = 64 * MiB;
export const DECODED_METADATA_BYTES = 4 * MiB;
export const DICTIONARY_BYTES = 16 * MiB;
export const REPLAY_FRAMES = 2_000_000;

export function limitError(message) {
  return Object.assign(new Error(message), { status: 413 });
}

// Stat and read the same descriptor; a changing file cannot grow beyond the budget.
export async function readLimitedFile(filename, limit) {
  const file = await open(filename, "r");
  try {
    const info = await file.stat();
    if (!info.isFile()) throw new Error("Ожидается обычный файл");
    if (info.size > limit) throw limitError(`Файл превышает ${limit / MiB} МБ`);
    const chunks = [];
    let total = 0;
    while (true) {
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, limit - total + 1));
      const { bytesRead } = await file.read(chunk);
      if (!bytesRead) break;
      total += bytesRead;
      if (total > limit) throw limitError(`Файл превышает ${limit / MiB} МБ`);
      chunks.push(chunk.subarray(0, bytesRead));
    }
    return Buffer.concat(chunks, total);
  } finally {
    await file.close();
  }
}
