export function restoreRenderSettings<T>(
  defaults: T,
  serialized: string | null,
  recordingMigrated: boolean,
): T;
export function storedVolume(value: string | null): number;
export function readSession(key: string): string | null;
export function writeSession(key: string, value: string): void;
