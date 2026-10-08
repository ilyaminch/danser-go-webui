import type { Palette } from "../shared/palette.mjs";
export type Replay = {
  id: string;
  filename: string;
  mapHash: string;
  player: string;
  date: string | null;
  score: number;
  accuracy: number;
  combo: number;
  misses: number;
  modList: string[];
  source: string;
  group: string;
  duration: number;
};
export type MapInfo = {
  id: string;
  hash: string;
  title: string;
  artist: string;
  difficulty: string;
  creator: string;
  beatmapId: string;
  firstTime: number;
  lastObjectTime: number;
};
export type Config = {
  enginePath: string;
  songsDir: string;
  lazerDir?: string;
  skinsDir: string;
  replaysDir: string;
  outputDir: string;
  ffmpegPath: string;
};
export type Project = {
  id?: string;
  name: string;
  kind: string;
  mapHash: string;
  replayIds: string[];
  palette: Palette;
  rules: {
    mode: number;
    minPlayers: number;
    grace: number;
    revive: boolean;
    addDanser: boolean;
    liveSort: boolean;
    sortBy: string;
  };
  export: {
    width: number;
    height: number;
    fps: number;
    encoder: string;
    container: string;
  };
  launch: Record<string, any>;
  configPatch: Record<string, any>;
};
