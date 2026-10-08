import { parentPort, workerData } from 'node:worker_threads';
import { parseReplay } from './replay.mjs';
try {parentPort.postMessage({replay:await parseReplay(Buffer.from(workerData.buffer),workerData.name)});}
catch(error){parentPort.postMessage({error:error.message});}
