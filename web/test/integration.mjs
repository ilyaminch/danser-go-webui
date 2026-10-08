import { spawn } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { writeFixtures, makeReplay } from './fixtures.mjs';
import { runCommand } from '../server/render.mjs';

const root=path.resolve('..'),testDir=path.resolve('data/integration',String(Date.now())),port=3105;
const testFFmpeg=process.env.STUDIO_TEST_FFMPEG||'ffmpeg';
if(path.isAbsolute(testFFmpeg))process.env.PATH=path.dirname(testFFmpeg)+path.delimiter+(process.env.PATH||'');
await mkdir(testDir,{recursive:true});
const fixture=await writeFixtures(path.join(testDir,'fixtures'));
const server=spawn(process.execPath,['server/index.mjs'],{cwd:path.join(root,'web'),env:{...process.env,PORT:String(port),STUDIO_DATA_DIR:path.join(testDir,'store')},windowsHide:true});
let serverLog='';server.stdout.on('data',b=>serverLog+=b);server.stderr.on('data',b=>serverLog+=b);
const request=async(endpoint,method='GET',data)=>{const options={method,headers:{'X-Studio-Client':'1'}};if(data instanceof FormData)options.body=data;else if(data!==undefined){options.headers['Content-Type']='application/json';options.body=JSON.stringify(data);}const response=await fetch(`http://127.0.0.1:${port}/api${endpoint}`,options);const result=await response.json();if(!response.ok)throw new Error(result.error);return result;};
async function waitUntil(fn,timeout=180000){const started=Date.now();while(Date.now()-started<timeout){const result=await fn();if(result)return result;await new Promise(r=>setTimeout(r,300));}throw new Error('Превышено время ожидания');}
try {
  await waitUntil(async()=>{try{return await request('/state');}catch{return false;}},20000);
  const rejected=await fetch(`http://127.0.0.1:${port}/api/config`,{method:'PUT',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(rejected.status,403);
  await request('/config','PUT',{enginePath:path.join(root,'runtime/danser-studio.exe'),songsDir:fixture.songs,ffmpegPath:testFFmpeg,outputDir:path.join(testDir,'videos'),skinsDir:'',replaysDir:fixture.replays});
  const health=await request('/health');assert.ok(health.engine&&health.studio&&health.ffmpeg&&health.songs,JSON.stringify(health));
  const maps=await request('/maps/scan','POST');assert.equal(maps.maps.length,1);
  const form=new FormData();for(const name of ['old.osr','new.osr'])form.append('files',new Blob([await readFile(path.join(fixture.replays,name))]),name);
  form.append('files',new Blob([await makeReplay({mode:1})]),'taiko.osr');
  const imported=await request('/import','POST',form);assert.equal(imported.imported.length,2);assert.equal(imported.errors.length,1);
  const duplicate=new FormData();duplicate.append('files',new Blob([await readFile(path.join(fixture.replays,'old.osr'))]),'renamed.osr');assert.equal((await request('/import','POST',duplicate)).duplicates.length,1);
  const project={name:'Studio training test',kind:'comparison',mapHash:fixture.hash,replayIds:imported.imported.map(r=>r.id),palette:{mode:'date',spacing:'rank',stops:['#ff0000','#ffff00','#00ff00'],reverse:false,unknown:'#999999',players:{},overrides:{}},rules:{mode:0,minPlayers:0,grace:-10,revive:false,addDanser:false,liveSort:true,sortBy:'Score'},export:{width:640,height:360,fps:30,encoder:'libx264',container:'mp4'},launch:{speed:1,pitch:1,cursors:1,tag:1,start:0,end:7,screenshotTime:3.5,noUpdateCheck:true},configPatch:{General:{DiscordPresenceOn:false},Recording:{MotionBlur:{Enabled:false}},Playfield:{LeadInTime:0,LeadInHold:0,FadeOutTime:0,SeizureWarning:{Enabled:false}},Audio:{GeneralVolume:.2}}};
  const saved=await request('/projects','POST',project);assert.ok(saved.id);await request('/projects/validate','POST',project);
  const first=await request('/jobs','POST',{project,action:'record'});
  const second=await request('/jobs','POST',{project:{...project,name:'Studio showcase test',rules:{...project.rules,mode:2}},action:'screenshot'});
  const third=await request('/jobs','POST',{project:{...project,name:'Studio late start test',launch:{...project.launch,start:3}},action:'screenshot'});
  console.log(`Integration jobs: ${first.id}, ${second.id}, ${third.id}`);
  const all=await waitUntil(async()=>{const state=await request('/state');const jobs=state.jobs.filter(j=>[first.id,second.id,third.id].includes(j.id));return jobs.length===3&&jobs.every(j=>!['running','queued'].includes(j.status))?jobs:false;});
  for(const job of all){await writeFile(path.join(testDir,`${job.id}.log`),job.log);assert.equal(job.status,'completed',`${job.name}: ${job.error}\n${job.log.slice(-5000)}`);}
  const record=all.find(j=>j.id===first.id),screenshot=all.find(j=>j.id===second.id),late=all.find(j=>j.id===third.id);assert.equal([...record.log.matchAll(/has broken! Max combo:/g)].length,1,'Exactly the old replay should be eliminated');assert.ok(record.log.includes('100.00'),'The new attempt should finish with 100% accuracy');assert.ok(!screenshot.log.includes('has broken! Max combo:'),'Showcase unexpectedly eliminated a replay');assert.equal([...late.log.matchAll(/has broken! Max combo:/g)].length,1,'Late preview must preserve eliminations before the start');
  const media=JSON.parse(await runCommand('ffprobe',['-v','error','-show_streams','-show_format','-of','json',record.output]));assert.ok(media.streams.some(s=>s.codec_type==='video'&&s.width===640&&s.height===360));
  const manifest=JSON.parse(await readFile(path.join(testDir,'store/jobs',first.id,'manifest.json'),'utf8'));assert.equal(manifest.Replays.find(r=>r.SHA256===imported.imported.find(r=>r.filename==='old.osr').id).Color,'#ff0000');assert.equal(manifest.Replays.find(r=>r.SHA256===imported.imported.find(r=>r.filename==='new.osr').id).Color,'#00ff00');
  console.log(JSON.stringify({ok:true,testDir,record:record.output,screenshot:screenshot.output,late:late.output,duration:media.format.duration},null,2));
  await writeFile(path.join(testDir,'result.json'),JSON.stringify({ok:true,record:record.output,screenshot:screenshot.output,late:late.output},null,2));
} finally {server.kill();await writeFile(path.join(testDir,'server.log'),serverLog);}
