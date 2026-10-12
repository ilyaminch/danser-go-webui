import { Worker } from "node:worker_threads";
function parseInWorker(script, buffer, name, timeout) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(script, import.meta.url), {
      workerData: { buffer, name },
      resourceLimits: {
        maxOldGenerationSizeMb: 160,
        maxYoungGenerationSizeMb: 32,
      },
    });
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new Error("Превышено время обработки файла"));
    }, timeout);
    const finish = () => {
      clearTimeout(timer);
      void worker.terminate();
    };
    worker.once("message", (message) => {
      finish();
      message.error
        ? reject(new Error(message.error))
        : resolve(message.replay ?? message.map);
    });
    worker.once("error", (error) => {
      finish();
      reject(new Error(`Не удалось прочитать реплей: ${error.message}`));
    });
    worker.once("exit", () => {
      clearTimeout(timer);
      reject(new Error("Обработка файла остановлена"));
    });
  });
}
export const parseSafely = (buffer, name) =>
  parseInWorker("./replay-worker.mjs", buffer, name, 30000);
// Reuse one bounded map worker during catalog scans instead of starting thousands.
let mapWorker,
  idleTimer,
  mapQueue = Promise.resolve(),
  pendingMaps = 0;
function parseMapInWorker(buffer, name) {
  clearTimeout(idleTimer);
  mapWorker ??= new Worker(new URL("./map-worker.mjs", import.meta.url), {
    resourceLimits: {
      maxOldGenerationSizeMb: 160,
      maxYoungGenerationSizeMb: 32,
    },
  });
  const worker = mapWorker;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      finish(new Error("Обработка карты превысила 10 секунд"));
    }, 10000);
    const finish = (error, map) => {
      clearTimeout(timer);
      worker.off("message", message);
      worker.off("error", failed);
      worker.off("exit", exited);
      if (error) {
        mapWorker = undefined;
        void worker.terminate();
        reject(error);
      } else {
        resolve(map);
        idleTimer = setTimeout(() => {
          if (mapWorker === worker) {
            mapWorker = undefined;
            void worker.terminate();
          }
        }, 1000);
        idleTimer.unref();
      }
    };
    const message = (result) =>
      result.error ? finish(new Error(result.error)) : finish(null, result.map);
    const failed = (error) => finish(error);
    const exited = () => finish(new Error("Обработка карты остановлена"));
    worker.once("message", message);
    worker.once("error", failed);
    worker.once("exit", exited);
    worker.postMessage({ buffer, name });
  });
}
export function parseMapSafely(buffer, name) {
  if (pendingMaps >= 16)
    return Promise.reject(
      new Error("Слишком много одновременных запросов карт"),
    );
  pendingMaps++;
  const task = mapQueue.then(() => parseMapInWorker(buffer, name));
  mapQueue = task.catch(() => {});
  return task.finally(() => pendingMaps--);
}
