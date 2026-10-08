import { createHash } from 'node:crypto';
import lzma from 'lzma';

const MODS = ['NF','EZ','TD','HD','HR','SD','DT','RX','HT','NC','AT','SO','AP','PF','4K','5K','6K','7K','8K','FI','RD','CN','TP','9K','CO','1K','3K','2K','V2','MR'];
function decompress(buffer) {
  if (buffer.length < 13) throw new Error('Повреждённые данные движения');
  const size = buffer.readBigUInt64LE(5);
  if (size !== 0xffffffffffffffffn && size > 64n * 1024n * 1024n) throw new Error('Распакованные данные превышают 64 МБ');
  return new Promise((resolve, reject) => lzma.decompress([...buffer], (result, error) => error ? reject(new Error('Не удалось распаковать данные реплея')) : resolve(typeof result === 'string' ? result : Buffer.from(result).toString('utf8'))));
}

export async function parseReplay(buffer, filename) {
  let offset = 0;
  const take = n => { if (n < 0 || offset + n > buffer.length) throw new Error('Файл обрезан или повреждён'); const v = buffer.subarray(offset, offset + n); offset += n; return v; };
  const u8 = () => take(1)[0], u16 = () => take(2).readUInt16LE(), i32 = () => take(4).readInt32LE();
  const str = () => { const tag = u8(); if (!tag) return ''; if (tag !== 11) throw new Error('Некорректная строка .osr'); let n=0, shift=0, b; do { b=u8(); n+=(b&127)*2**shift; shift+=7; if (shift>28) throw new Error('Строка слишком длинная'); } while (b&128); return take(n).toString('utf8'); };
  const mode=u8(), version=i32();
  if (mode !== 0) throw new Error('Поддерживается только osu!standard');
  const mapHash=str().toLowerCase(), player=str(), replayHash=str();
  if (!/^[a-f0-9]{32}$/.test(mapHash)) throw new Error('Некорректный MD5 карты');
  const count300=u16(), count100=u16(), count50=u16(); u16(); u16(); const misses=u16();
  const score=i32(), combo=u16(), fullCombo=Boolean(u8()), mods=take(4).readUInt32LE();
  str(); const ticks=take(8).readBigInt64LE();
  const millis=Number((ticks - 621355968000000000n)/10000n);
  const date=ticks > 0n && Number.isFinite(millis) && Math.abs(millis)<8640000000000000 ? new Date(millis).toISOString() : null;
  const length=i32(); if (length<=0 || length>20*1024*1024) throw new Error('Нет данных движения или реплей превышает 20 МБ');
  const frames=await decompress(take(length));
  let time=0, frameCount=0, lastTime=0;
  for (const frame of frames.split(',')) {
    if (!frame.trim()) continue;
    const parts=frame.split('|'), values=parts.map(Number);
    if (parts.length!==4 || !values.every(Number.isFinite)) throw new Error('Повреждённый кадр движения');
    if (values[0] === -12345) continue;
    time+=values[0]; lastTime=Math.max(lastTime,time); frameCount++;
  }
  if (frameCount<2) throw new Error('Недостаточно кадров движения');
  let scoreId=null, scoreInfo=null;
  if (buffer.length-offset>=8) scoreId=take(8).readBigInt64LE().toString();
  else if (buffer.length-offset>=4) scoreId=String(i32());
  if (buffer.length-offset>=4) { const n=i32(); if(n<0)throw new Error('Некорректная длина метаданных');if(n>0) { scoreInfo=JSON.parse(await decompress(take(n))); if (scoreInfo.online_id) scoreId=String(scoreInfo.online_id); } }
  const total=count300+count100+count50+misses;
  const modList=scoreInfo?.mods?.map(m=>m.acronym) ?? MODS.filter((_,i)=> (mods & 2**i)!==0);
  if(modList.includes('NC')) modList.splice(modList.indexOf('DT'), modList.includes('DT')?1:0);
  if(modList.includes('PF')) modList.splice(modList.indexOf('SD'), modList.includes('SD')?1:0);
  return {id:createHash('sha256').update(buffer).digest('hex'), filename, mapHash, player:player || 'Без имени', replayHash, version, source:version>=30000000?'lazer':'stable', date, score, combo, fullCombo, mods, modList, scoreInfo, scoreId, count300, count100, count50, misses, accuracy:total?(count300*300+count100*100+count50*50)/(total*300)*100:0, frameCount, duration:lastTime/1000, group:''};
}
