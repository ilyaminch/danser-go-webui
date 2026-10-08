export function interpolate(stops, t) {
  const colors = stops.filter(s => /^#[0-9a-f]{6}$/i.test(s));
  if (!colors.length) return '#8b9cf7';
  const p = Math.max(0, Math.min(1, t)) * (colors.length - 1);
  const a = colors[Math.floor(p)], b = colors[Math.min(colors.length - 1, Math.floor(p) + 1)];
  return '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) + (parseInt(b.slice(i, i + 2), 16) - parseInt(a.slice(i, i + 2), 16)) * (p % 1)).toString(16).padStart(2, '0')).join('');
}

export function assignColors(replays, palette) {
  const result = {};
  const groups = new Map();
  for (const replay of replays) {
    const key = palette.mode === 'per-player' ? replay.player : 'all';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(replay);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => (a.date ? Date.parse(a.date) : Infinity) - (b.date ? Date.parse(b.date) : Infinity) || a.id.localeCompare(b.id));
    const dated = list.filter(r => r.date && Number.isFinite(Date.parse(r.date)));
    const dates = [...new Set(dated.map(r => Date.parse(r.date)))].sort((a,b) => a-b);
    for (const replay of list) {
      let color = palette.unknown ?? '#9198a8';
      if (palette.mode === 'player') color = palette.players?.[replay.player] ?? '#8b9cf7';
      else if (replay.date && dates.length) {
        const time = Date.parse(replay.date);
        const t = dates.length < 2 ? 0 : palette.spacing === 'time' ? (time - dates[0]) / (dates.at(-1) - dates[0]) : dates.indexOf(time) / (dates.length - 1);
        color = interpolate(palette.reverse ? [...palette.stops].reverse() : palette.stops, t);
      }
      result[replay.id] = /^#[0-9a-f]{6}$/i.test(palette.overrides?.[replay.id] ?? '') ? palette.overrides[replay.id] : color;
    }
  }
  return result;
}
