import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export function parseMap(buffer,absolute) {
  const text=buffer.toString('utf8').replace(/^\uFEFF/,''),values={};
  let section='',first=Infinity,last=0;
  for(const raw of text.split(/\r?\n/)) {
    const line=raw.trim();if(line.startsWith('[')){section=line;continue;}
    if(['[Metadata]','[General]','[Difficulty]'].includes(section)){const i=line.indexOf(':');if(i>0)values[line.slice(0,i).trim()]=line.slice(i+1).trim();}
    if(section==='[HitObjects]'){const parts=line.split(','),time=Number(parts[2]);if(parts.length>=5&&Number.isFinite(time)){first=Math.min(first,time);last=Math.max(last,time);}}
  }
  if(Number(values.Mode??0)!==0)return null;
  const hash=createHash('md5').update(buffer).digest('hex');
  return {id:hash,hash,path:absolute,title:values.TitleUnicode||values.Title||path.basename(absolute),artist:values.ArtistUnicode||values.Artist||'',difficulty:values.Version||'',creator:values.Creator||'',beatmapId:values.BeatmapID||'',setId:values.BeatmapSetID||'',cs:Number(values.CircleSize),ar:Number(values.ApproachRate??values.OverallDifficulty),od:Number(values.OverallDifficulty),hp:Number(values.HPDrainRate),firstTime:Number.isFinite(first)?first/1000:0,lastObjectTime:last/1000};
}

export async function scanMaps(root) {
  const maps=[],errors=[];
  async function walk(dir,depth=0) {
    if(depth>5) return;
    let files; try {files=await readdir(dir,{withFileTypes:true});} catch(e){errors.push(`${dir}: ${e.message}`);return;}
    for(const file of files) {
      const absolute=path.join(dir,file.name);
      if(file.isDirectory()) await walk(absolute,depth+1);
      else if(file.name.toLowerCase().endsWith('.osu')) {
        try {
          const map=parseMap(await readFile(absolute),absolute);if(map)maps.push({...map,source:'songs',sourceRoot:path.resolve(root)});
        } catch(e){errors.push(`${file.name}: ${e.message}`);}
      }
    }
  }
  await walk(root);return {maps,errors};
}
