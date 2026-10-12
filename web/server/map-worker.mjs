import { parentPort } from "node:worker_threads";
import { parseMap } from "./maps.mjs";
parentPort.on("message", ({ buffer, name }) => {
  try {
    parentPort.postMessage({ map: parseMap(Buffer.from(buffer), name) });
  } catch (error) {
    parentPort.postMessage({ error: error.message });
  }
});
