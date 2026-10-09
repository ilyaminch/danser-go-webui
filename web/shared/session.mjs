const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function readSession(key) {
  try {
    return globalThis.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writeSession(key, value) {
  try {
    globalThis.sessionStorage.setItem(key, value);
  } catch {
    // Storage is optional: the current in-memory session remains usable.
  }
}

export function restoreRenderSettings(defaults, serialized, recordingMigrated) {
  try {
    const saved = JSON.parse(serialized);
    if (!object(saved)) return defaults;
    const kind = ["dance", "autoplay"].includes(saved.kind)
      ? saved.kind
      : "comparison";
    const restored = {
      ...defaults,
      name: typeof saved.name === "string" ? saved.name : defaults.name,
      kind,
      visualization: ["dance", "autoplay"].includes(saved.visualization)
        ? saved.visualization
        : kind === "autoplay"
          ? "autoplay"
          : "dance",
      palette: {
        ...defaults.palette,
        ...(object(saved.palette) ? saved.palette : {}),
      },
      rules: { ...defaults.rules, ...(object(saved.rules) ? saved.rules : {}) },
      export: {
        ...defaults.export,
        ...(object(saved.export) ? saved.export : {}),
      },
      launch: {
        ...defaults.launch,
        ...(object(saved.launch) ? saved.launch : {}),
        ...(kind === "comparison" ? { mods: "", mods2: "" } : {}),
      },
      configPatch: object(saved.configPatch)
        ? saved.configPatch
        : defaults.configPatch,
      replayIds: [],
      mapHash: "",
    };
    if (
      !Array.isArray(restored.palette.stops) ||
      restored.palette.stops.length < 2 ||
      restored.palette.stops.some(
        (color) => typeof color !== "string" || !/^#[a-f\d]{6}$/i.test(color),
      )
    )
      restored.palette.stops = defaults.palette.stops;
    for (const key of ["players", "overrides"])
      if (!object(restored.palette[key]))
        restored.palette[key] = defaults.palette[key];
    if (!recordingMigrated) {
      restored.export = defaults.export;
      restored.configPatch = {
        ...restored.configPatch,
        Recording: {
          ...(object(restored.configPatch.Recording)
            ? restored.configPatch.Recording
            : {}),
          ...defaults.configPatch.Recording,
        },
      };
    }
    return restored;
  } catch {
    return defaults;
  }
}

export function storedVolume(value) {
  const parsed = value === null || value.trim() === "" ? NaN : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0.25;
}
