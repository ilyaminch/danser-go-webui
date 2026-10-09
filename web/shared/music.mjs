export function previewStart(
  previewMilliseconds,
  audioDuration,
  mapEnd = audioDuration,
) {
  if (!Number.isFinite(audioDuration) || audioDuration <= 0) return 0;
  const explicit = previewMilliseconds / 1000;
  if (Number.isFinite(explicit) && explicit >= 0 && explicit < audioDuration)
    return explicit;
  const end =
    Number.isFinite(mapEnd) && mapEnd > 0
      ? Math.min(mapEnd, audioDuration)
      : audioDuration;
  return end * 0.4;
}
