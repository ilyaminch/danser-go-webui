import lzma from 'lzma';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runCommand } from '../server/render.mjs';

const encodeString=s=>{const bytes=Buffer.from(s);if(!bytes.length)return Buffer.from([0]);let n=bytes.length,leb=[];do{let b=n&127;n>>>=7;if(n)b|=128;leb.push(b);}while(n);return Buffer.concat([Buffer.from([11,...leb]),bytes]);};
const int=(n,size=4)=>{const b=Buffer.alloc(size);size===2?b.writeUInt16LE(n):b.writeInt32LE(n);return b;};
export const compress=text=>new Promise((resolve,reject)=>lzma.compress(text,1,(result,error)=>error?reject(error):resolve(Buffer.from(result))));
export const makeMap=()=>`osu file format v14

[General]
AudioFilename: song.wav
AudioLeadIn: 0
PreviewTime: 1000
Mode: 0

[Metadata]
Title: Studio integration test
Artist: Generated test tone
Creator: Danser Studio
Version: Training
BeatmapID: 999999990
BeatmapSetID: 999999990

[Difficulty]
HPDrainRate: 5
CircleSize: 4
OverallDifficulty: 5
ApproachRate: 5
SliderMultiplier: 1.4
SliderTickRate: 1

[TimingPoints]
0,600,4,1,0,30,1,0

[HitObjects]
${Array.from({length:8},(_,i)=>`${128+(i%3)*128},${128+(i%2)*128},${1000+i*600},1,0,0:0:0:0:`).join('\n')}
`;
export async function makeReplay({mapHash='0123456789abcdef0123456789abcdef',player='Test Player',date='2026-01-01T00:00:00Z',misses=0,score=100000,mods=0,mode=0,frames,cursorOffset=0}={}) {
  let last=0;const replayFrames=['0|256|192|0'];
  for(let i=0;i<8;i++){
    const time=1000+i*600,x=128+(i%3)*128+cursorOffset,y=128+(i%2)*128;
    // Stable encodes keyboard K1 together with the left-click bit (4 | 1).
    replayFrames.push(`${time-100-last}|${x}|${y}|0`,`100|${x}|${y}|${i<misses?0:5}`,'30|'+x+'|'+y+'|0');last=time+30;
  }
  replayFrames.push(`${6200-last}|256|192|0`,'-12345|0|0|42');
  const compressed=await compress(frames??replayFrames.join(','));
  const ticks=Buffer.alloc(8);ticks.writeBigInt64LE(BigInt(Date.parse(date))*10000n+621355968000000000n);
  return Buffer.concat([Buffer.from([mode]),int(20200101),encodeString(mapHash),encodeString(player),encodeString('fixture'),int(8-misses,2),int(0,2),int(0,2),int(0,2),int(0,2),int(misses,2),int(score),int(8-misses,2),Buffer.from([misses?0:1]),int(mods),encodeString(''),ticks,int(compressed.length),compressed,Buffer.alloc(8)]);
}
export async function writeFixtures(dir) {
  const songs=path.join(dir,'Songs','Studio Test'),replays=path.join(dir,'Replays');await mkdir(songs,{recursive:true});await mkdir(replays,{recursive:true});
  const map=makeMap(),hash=createHash('md5').update(map).digest('hex');await writeFile(path.join(songs,'training.osu'),map);
  await runCommand('ffmpeg',['-y','-f','lavfi','-i','sine=frequency=440:duration=8','-ar','44100','-ac','2',path.join(songs,'song.wav')]);
  const old=await makeReplay({mapHash:hash,date:'2025-01-01T00:00:00Z',misses:3,score:1000,cursorOffset:20}),recent=await makeReplay({mapHash:hash,date:'2026-10-01T00:00:00Z',score:5000});
  await writeFile(path.join(replays,'old.osr'),old);await writeFile(path.join(replays,'new.osr'),recent);
  return {hash,songs:path.dirname(songs),replays};
}
if(process.argv[1]?.endsWith('fixtures.mjs'))console.log(await writeFixtures(path.resolve('data/test-fixtures')));
