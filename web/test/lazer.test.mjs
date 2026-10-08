import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,readFile,stat,access,rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { indexLazer,prepareMapView,storageFile,safeResourceName,resolveMap } from '../server/lazer.mjs';
import { openStore } from '../server/store.mjs';

test('lazer references resolve by exact replay MD5; render view links assets and cleans up without changing originals',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'studio-lazer-test-')),store=openStore(path.join(root,'studio'));
  try{
    await writeFile(path.join(root,'client.realm'),'test index');
    const osu=Buffer.from('osu file format v14\n[General]\nAudioFilename: track.wav\nMode: 0\n[Metadata]\nTitle: Local map\nVersion: Hard\n[HitObjects]\n256,192,1000,1,0,0:0:0:0:\n'),audio=Buffer.from('audio fixture');
    const hash=createHash('md5').update(osu).digest('hex'),sha=createHash('sha256').update(osu).digest('hex'),audioSha=createHash('sha256').update(audio).digest('hex');
    for(const [digest,bytes] of [[sha,osu],[audioSha,audio]]){const file=storageFile(root,digest);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);}
    const raw={maps:[{hash,sha256:sha,setKey:'set'}],sets:{set:[{name:'map.osu',sha256:sha},{name:'track.wav',sha256:audioSha}]}};
    const result=await indexLazer(store,root,raw);assert.equal(result.errors.length,0);assert.equal(result.maps.length,1);
    const map=await resolveMap(store,hash);assert.equal(map.title,'Local map');assert.equal(map.path,storageFile(root,sha));
    const view=await prepareMapView(store,map,{lazerDir:root});
    assert.equal((await stat(path.join(view.songsDir,'map','track.wav'))).ino,(await stat(storageFile(root,audioSha))).ino);
    assert.deepEqual(await readFile(path.join(view.songsDir,'map','map.osu')),osu);
    await view.cleanup();await assert.rejects(()=>access(view.songsDir));assert.deepEqual(await readFile(storageFile(root,sha)),osu);assert.deepEqual(await readFile(storageFile(root,audioSha)),audio);
    await assert.rejects(()=>resolveMap(store,'0'.repeat(32)),/Точная версия/);
    await assert.rejects(()=>prepareMapView(store,map,{lazerDir:path.join(root,'other')}),/Источник/);
  }finally{store.close();const relative=path.relative(tmpdir(),root);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));await rm(root,{recursive:true,force:true});}
});
test('lazer resource paths reject traversal, absolute paths and Windows aliases',()=>{
  for(const bad of ['../outside','a/../../b','C:/secret','/absolute','a\\..\\secret','NUL.wav','a./b','a//b'])assert.throws(()=>safeResourceName(bad));
  assert.equal(safeResourceName('samples\\hit.wav'),'samples/hit.wav');assert.throws(()=>storageFile('root','../../bad'));
});
