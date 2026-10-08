export type Palette = {mode:'date'|'per-player'|'player'; spacing:'rank'|'time'; stops:string[]; reverse:boolean; unknown:string; players:Record<string,string>; overrides:Record<string,string>};
export function interpolate(stops:string[], t:number):string;
export function assignColors(replays:{id:string;player:string;date:string|null}[],palette:Palette):Record<string,string>;
