import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// Read the pinned engine's public Go fields and UI tags; defaults remain owned by danser.
export async function loadSchema(engineDir) {
  const types={};
  for(const file of await readdir(path.join(engineDir,'app/settings'))) {
    if(!file.endsWith('.go') || file==='general_others.go') continue;
    const source=await readFile(path.join(engineDir,'app/settings',file),'utf8');
    for(const match of source.matchAll(/type\s+(\w+)\s+struct\s*\{([\s\S]*?)^\}/gm)) {
      const fields=[]; let comment=[];
      for(const line of match[2].split('\n')) {
        if(line.trim().startsWith('//')) {comment.push(line.trim().slice(2).trim());continue;}
        const field=line.match(/^\s*([A-Z]\w*(?:\s*,\s*[A-Z]\w*)*)\s+(\[\])?(\*?\w+(?:\.\w+)?)(?:\s+`([^`]+)`)?/);
        if(field) {
          const tags=Object.fromEntries([...String(field[4]??'').matchAll(/(\w+):"([^"]*)"/g)].map(m=>[m[1],m[2]]));
          for(const name of field[1].split(',').map(s=>s.trim())) {
            const key=(tags.json?.split(',')[0] || name);
            if(key==='-') continue;
            fields.push({name,key,type:field[3].replace(/^\*/,''),array:Boolean(field[2]),tags,description:comment.join(' '),file});
          }
        }
        comment=[];
      }
      types[match[1]]=fields;
    }
  }
  const build=(type,seen=[]) => (types[type]??[]).map(field=>({...field,children:!seen.includes(field.type)&&types[field.type]?build(field.type,[...seen,type]):undefined}));
  return {sections:build('CombinedConfig'),source:'danser-go/app/settings',types:Object.keys(types).length};
}
