export type Palette = {
  mode: "date" | "per-player" | "player";
  enabled?: boolean;
  frozen?: Record<string, string>;
  spacing: "rank" | "time";
  stops: string[];
  reverse: boolean;
  unknown: string;
  players: Record<string, string>;
  overrides: Record<string, string>;
};
export function interpolate(stops: string[], t: number): string;
export function assignColors(
  replays: { id: string; player: string; date: string | null }[],
  palette: Palette,
): Record<string, string>;
export function setGradientEnabled(
  replays: { id: string; player: string; date: string | null }[],
  palette: Palette,
  enabled: boolean,
): Palette;
export function capturePalette(
  replays: { id: string; player: string; date: string | null }[],
  palette: Palette,
): Palette;
