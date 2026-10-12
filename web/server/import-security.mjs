import { IMPORT_BYTES, limitError } from "./limits.mjs";

export function frameProtection(_req, res, next) {
  res.set("Content-Security-Policy", "frame-ancestors 'none'");
  res.set("X-Frame-Options", "DENY");
  next();
}

// Serializing imports also bounds retained buffers across simultaneous requests.
export function createImportGate() {
  let active = false;
  return (req, res, next) => {
    if (active)
      return res
        .status(429)
        .json({ error: "Дождитесь завершения текущего импорта" });
    active = true;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active = false;
      res.off("finish", release);
      req.off("aborted", release);
    };
    req.releaseImport = release;
    res.once("finish", release);
    req.once("aborted", release);
    next();
  };
}

const bytes = Symbol("importBytes");
// Multer's per-file limit alone does not bound a chunked batch of many files.
export function boundedMemoryStorage(limit = IMPORT_BYTES) {
  return {
    _handleFile(req, file, callback) {
      const chunks = [];
      let size = 0,
        done = false;
      const finish = (error) => {
        if (done) return;
        done = true;
        file.stream.off("data", data);
        file.stream.off("end", end);
        req.off("aborted", aborted);
        const buffer = error ? undefined : Buffer.concat(chunks, size);
        chunks.length = 0;
        callback(error, error ? undefined : { buffer, size });
      };
      const data = (chunk) => {
        req[bytes] = (req[bytes] ?? 0) + chunk.length;
        if (req[bytes] > limit) {
          finish(limitError("Импортируйте не более 256 МБ за один раз"));
          file.stream.resume();
          return;
        }
        size += chunk.length;
        chunks.push(chunk);
      };
      const end = () => finish();
      const aborted = () => {
        finish(new Error("Загрузка прервана"));
        file.stream.resume();
      };
      req.once("aborted", aborted);
      file.stream.on("data", data);
      file.stream.once("error", finish);
      file.stream.once("end", end);
    },
    _removeFile(_req, file, callback) {
      delete file.buffer;
      callback(null);
    },
  };
}
