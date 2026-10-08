import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export function openStore(dir) {
  mkdirSync(dir,{recursive:true});
  const db=new DatabaseSync(path.join(dir,'studio.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS items (kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(kind,id));');
  return {
    list(kind){return db.prepare('SELECT data FROM items WHERE kind=? ORDER BY rowid DESC').all(kind).map(r=>JSON.parse(r.data));},
    get(kind,id){const row=db.prepare('SELECT data FROM items WHERE kind=? AND id=?').get(kind,id);return row?JSON.parse(row.data):null;},
    put(kind,item){db.prepare('INSERT INTO items(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data').run(kind,item.id,JSON.stringify(item));return item;},
    remove(kind,id){db.prepare('DELETE FROM items WHERE kind=? AND id=?').run(kind,id);},
    close(){db.close();}
  };
}
