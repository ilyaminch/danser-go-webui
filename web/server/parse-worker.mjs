import { Worker } from 'node:worker_threads';
export function parseSafely(buffer,name) {
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./replay-worker.mjs',import.meta.url),{workerData:{buffer,name},resourceLimits:{maxOldGenerationSizeMb:160,maxYoungGenerationSizeMb:32}});
    const timer=setTimeout(()=>{void worker.terminate();reject(new Error('Обработка реплея превысила 30 секунд'));},30000);
    const finish=()=>{clearTimeout(timer);void worker.terminate();};
    worker.once('message',message=>{finish();message.error?reject(new Error(message.error)):resolve(message.replay);});
    worker.once('error',error=>{finish();reject(new Error(`Не удалось прочитать реплей: ${error.message}`));});
    worker.once('exit',code=>{clearTimeout(timer);if(code!==0)reject(new Error('Обработка реплея остановлена'));});
  });
}
