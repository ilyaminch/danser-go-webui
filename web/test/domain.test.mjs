import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makeReplay } from './fixtures.mjs';
import { parseReplay } from '../server/replay.mjs';
import { assignColors } from '../shared/palette.mjs';
import { buildArguments,validateProject,merge } from '../server/render.mjs';
import { openStore } from '../server/store.mjs';
import { loadSchema } from '../server/schema.mjs';

const palette={mode:'date',spacing:'rank',stops:['#ff0000','#ffff00','#00ff00'],reverse:false,unknown:'#999999',overrides:{},players:{}};
test('OSR header, UTC timestamp and compressed frames are parsed; corrupt/non-standard replays fail',async()=>{
  const data=await makeReplay({player:'Игрок №1',date:'2024-02-29T12:34:56.123Z',misses:2});const replay=await parseReplay(data,'one.osr');
  assert.equal(replay.player,'Игрок №1');assert.equal(replay.date,'2024-02-29T12:34:56.123Z');assert.equal(replay.misses,2);assert.equal(replay.accuracy,75);assert.equal(replay.duration,6.2);assert.equal(replay.id.length,64);
  await assert.rejects(()=>parseReplay(data.subarray(0,40),'broken.osr'));
  const taiko=await makeReplay({mode:1});
  await assert.rejects(()=>parseReplay(taiko,'taiko.osr'),/standard/);
  const malformed=await makeReplay({frames:'10|invalid|192|0,10|256|192|4'});
  await assert.rejects(()=>parseReplay(malformed,'bad.osr'),/кадр/);
});
test('palette uses dates, not score or list order; equal dates, unknown dates, overrides and players remain stable',()=>{
  const replays=[{id:'new',player:'A',date:'2026-01-01',score:1},{id:'old',player:'A',date:'2024-01-01',score:999},{id:'mid',player:'A',date:'2025-01-01'},{id:'same',player:'A',date:'2025-01-01'},{id:'none',player:'A',date:null}];
  const colors=assignColors(replays,palette);assert.equal(colors.old,'#ff0000');assert.equal(colors.new,'#00ff00');assert.equal(colors.mid,'#ffff00');assert.equal(colors.same,colors.mid);assert.equal(colors.none,'#999999');assert.deepEqual(colors,assignColors([...replays].reverse(),palette));
  assert.equal(assignColors(replays,{...palette,reverse:true}).old,'#00ff00');assert.equal(assignColors(replays,{...palette,overrides:{old:'#abcdef'}}).old,'#abcdef');
  assert.equal(assignColors(replays,{...palette,mode:'player',players:{A:'#aa88bb'}}).new,'#aa88bb');
});
test('time palette differs from rank palette; each player has an independent timeline',()=>{
  const replays=[{id:'a',player:'A',date:'2025-01-01'},{id:'b',player:'A',date:'2025-01-02'},{id:'c',player:'A',date:'2025-12-31'},{id:'d',player:'B',date:'2025-01-01'}];
  assert.notEqual(assignColors(replays,palette).b,assignColors(replays,{...palette,spacing:'time'}).b);assert.equal(assignColors(replays,{...palette,mode:'per-player'}).d,'#ff0000');
});
test('storage survives restart and deduplicates by replay identity',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'studio-store-'));let store=openStore(dir);try{store.put('replay',{id:'same',score:1});store.put('replay',{id:'same',score:2});store.close();store=openStore(dir);assert.equal(store.list('replay').length,1);assert.equal(store.get('replay','same').score,2);}finally{store.close();await rm(dir,{recursive:true,force:true});}
});
test('manifest is an argument array, with no replay list on Windows command line',()=>{
  const project={kind:'comparison',mapHash:'abc',launch:{start:0,end:null,speed:1,pitch:1,cursors:1,tag:1},};
  const args=buildArguments(project,'studio/id','D:\\some space\\manifest.json',[],'output','record');assert.equal(args[args.indexOf('-studio-manifest')+1],'D:\\some space\\manifest.json');assert.ok(!args.includes('-knockout2'));assert.ok(args.includes('-preciseprogress'));assert.ok(!args.includes('-end'));
});
test('nested configuration patches preserve unknown fields and reject prototype keys',()=>{
  assert.deepEqual(merge({Cursor:{Extra:1}},{Cursor:{CursorSize:3}}),{Cursor:{Extra:1,CursorSize:3}});assert.throws(()=>merge({},JSON.parse('{"__proto__":{"polluted":true}}')));
});
test('schema covers every public configuration section and JSON encoder aliases',async()=>{
  const schema=await loadSchema(path.resolve('../danser-go'));assert.equal(schema.sections.length,14);assert.ok(schema.sections.find(s=>s.key==='Cursor').children.some(s=>s.key==='TrailStyle'));assert.ok(schema.sections.find(s=>s.key==='Recording').children.some(s=>s.key==='libx264'));
});
