import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Disc3 as DiscIcon,
  ArrowDownToLine,
  Check,
  CircleHelp,
  Clapperboard,
  Clock3,
  Film,
  Layers3,
  LoaderCircle,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { assignColors } from "../shared/palette.mjs";
import "./style.css";
import { VinylStage } from "./VinylStage";
import { t, getLanguage, setLanguage, type Language } from "./i18n";
import type { Replay, MapInfo, Config, Project } from "./render-types";
import { FieldLabel } from "./controls";
import {
  PalettePanel,
  RulesPanel,
  ExportPanel,
  LaunchPanel,
} from "./RenderPanels";
import { CredentialsPanel } from "./CredentialsPanel";
import { LazerConnection } from "./LazerConnection";

type Job = {
  id: string;
  name: string;
  status: string;
  progress: number;
  action: string;
  createdAt: string;
  error?: string;
  log: string;
  output: string | null;
  retryable?: boolean;
};
type Field = {
  name: string;
  key: string;
  type: string;
  array: boolean;
  description: string;
  tags: Record<string, string>;
  children?: Field[];
};
type State = {
  replays: Replay[];
  maps: MapInfo[];
  jobs: Job[];
  config: Config;
};
const emptyState: State = {
  replays: [],
  maps: [],
  jobs: [],
  config: {
    enginePath: "",
    songsDir: "",
    skinsDir: "",
    replaysDir: "",
    outputDir: "",
    ffmpegPath: "ffmpeg",
  },
};
const freshProject = (): Project => ({
  name: "",
  kind: "comparison",
  visualization: "dance",
  mapHash: "",
  replayIds: [],
  palette: {
    mode: "date",
    spacing: "rank",
    stops: ["#ff66aa", "#9565f5", "#35ced3"],
    reverse: false,
    unknown: "#9198a8",
    players: {},
    overrides: {},
  },
  rules: {
    mode: 0,
    minPlayers: 0,
    grace: -10,
    revive: false,
    addDanser: false,
    liveSort: true,
    sortBy: "Score",
  },
  export: {
    width: 1920,
    height: 1080,
    fps: 60,
    encoder: "h264_nvenc",
    container: "mp4",
  },
  launch: {
    skinId: "",
    speed: 1,
    pitch: 1,
    cursors: 1,
    tag: 1,
    start: 0,
    end: null,
    offset: 0,
    noUpdateCheck: true,
    noDbCheck: false,
  },
  configPatch: {
    Recording: {
      EncodingFPSCap: 0,
      PixelFormat: "yuv420p",
      MotionBlur: { Enabled: false },
      h264_nvenc: { RateControl: "cq", CQ: 22, Profile: "high", Preset: "p4" },
    },
  },
});
const labels: Record<string, string> = {
  General: "Общие",
  Graphics: "Графика",
  Audio: "Звук",
  Input: "Управление",
  Gameplay: "Игровой интерфейс",
  Skin: "Скин",
  Cursor: "Курсоры",
  Objects: "Объекты",
  Playfield: "Игровое поле",
  CursorDance: "Танец курсоров",
  Knockout: "Сравнение и выбывание",
  Recording: "Запись видео",
  Debug: "Диагностика",
  Credentials: "Авторизация osu!",
};
const api = async (path: string, method = "GET", body?: unknown) => {
  const options: RequestInit = { method, headers: { "X-Studio-Client": "1" } };
  if (body instanceof FormData) options.body = body;
  else if (body !== undefined) {
    options.headers = {
      "X-Studio-Client": "1",
      "Content-Type": "application/json",
    };
    options.body = JSON.stringify(body);
  }
  const response = await fetch("/api" + path, options);
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || t("Не удалось выполнить запрос"));
  return data;
};
const fmtDate = (date: string | null) =>
  date
    ? new Intl.DateTimeFormat(getLanguage() === "ru" ? "ru-RU" : "en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(date))
    : t("Дата неизвестна");
const num = (n: number) =>
  new Intl.NumberFormat(getLanguage() === "ru" ? "ru-RU" : "en-GB").format(n);
function App() {
  const [language, changeLanguage] = useState<Language>(getLanguage);
  const [sceneTab, setSceneTab] = useState("rules");
  const [showExport, setShowExport] = useState(false);
  const [mapSearch, setMapSearch] = useState("");
  const jobDialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<State>(emptyState),
    [page, setPage] = useState("library"),
    [project, setProject] = useState<Project>(() => {
      try {
        const saved = sessionStorage.getItem("studio-render-settings");
        return saved
          ? {
              ...freshProject(),
              ...JSON.parse(saved),
              kind: !["dance", "autoplay"].includes(JSON.parse(saved).kind)
                ? "comparison"
                : JSON.parse(saved).kind,
              visualization:
                JSON.parse(saved).visualization ??
                (JSON.parse(saved).kind === "autoplay" ? "autoplay" : "dance"),
              launch: {
                ...JSON.parse(saved).launch,
                ...(!["dance", "autoplay"].includes(JSON.parse(saved).kind)
                  ? { mods: "", mods2: "" }
                  : {}),
              },
              ...(sessionStorage.getItem("studio-recording-defaults") !==
              "nvenc-p4-v1"
                ? {
                    export: { ...freshProject().export },
                    configPatch: {
                      ...JSON.parse(saved).configPatch,
                      Recording: {
                        ...JSON.parse(saved).configPatch?.Recording,
                        ...freshProject().configPatch.Recording,
                      },
                    },
                  }
                : {}),
              replayIds: [],
              mapHash: "",
            }
          : freshProject();
      } catch {
        return freshProject();
      }
    }),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
      null,
    ),
    [schema, setSchema] = useState<Field[]>([]),
    [section, setSection] = useState("Cursor"),
    [settingsSearch, setSettingsSearch] = useState(""),
    [jsonText, setJsonText] = useState("{}"),
    [jsonMode, setJsonMode] = useState(false),
    [health, setHealth] = useState<any>(null),
    [dragging, setDragging] = useState(false),
    [selectedJob, setSelectedJob] = useState<Job | null>(null),
    [cfg, setCfg] = useState<Config>(emptyState.config),
    [skins, setSkins] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    const { id, replayIds, mapHash, ...settings } = project;
    sessionStorage.setItem("studio-render-settings", JSON.stringify(settings));
    sessionStorage.setItem("studio-recording-defaults", "nvenc-p4-v1");
  }, [project]);
  const fileRef = useRef<HTMLInputElement>(null),
    mapRef = useRef<HTMLInputElement>(null),
    skinRef = useRef<HTMLInputElement>(null),
    configRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectedJob && jobDialog.current && !jobDialog.current.open)
      jobDialog.current.showModal();
  }, [selectedJob]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    setSelectedJob((current) =>
      current
        ? (state.jobs.find((job) => job.id === current.id) ?? current)
        : null,
    );
  }, [state.jobs]);
  const loadSkins = async () => setSkins(await api("/skins"));
  const refresh = async () => {
    const s = await api("/state");
    setState(s);
    setProject((p) => {
      const ids = p.replayIds.filter((id) =>
        s.replays.some((r: Replay) => r.id === id),
      );
      return {
        ...p,
        replayIds: ids,
        mapHash:
          p.kind === "comparison" ? (ids.length ? p.mapHash : "") : p.mapHash,
      };
    });
    return s;
  };
  useEffect(() => {
    refresh()
      .then((s) => {
        setCfg(s.config);
        if (s.replays.length)
          setProject((p) => ({
            ...p,
            mapHash: p.kind === "comparison" ? s.replays[0].mapHash : p.mapHash,
            replayIds: s.replays
              .filter((r: Replay) => r.mapHash === s.replays[0].mapHash)
              .map((r: Replay) => r.id),
          }));
      })
      .catch((e) => setNotice({ text: e.message, error: true }));
    api("/schema")
      .then((s) => setSchema(s.sections))
      .catch((e) => setNotice({ text: e.message, error: true }));
    loadSkins().catch((e) =>
      setNotice({
        text: t("Не удалось прочитать скины: {error}", { error: e.message }),
        error: true,
      }),
    );
    api("/health")
      .then(setHealth)
      .catch(() => {});
    const timer = setInterval(() => refresh().catch(() => {}), 2500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 9000);
    return () => clearTimeout(timer);
  }, [notice]);
  const perform = async (label: string, action: () => Promise<any>) => {
    setBusy(label);
    try {
      return await action();
    } catch (e) {
      setNotice({ text: (e as Error).message, error: true });
    } finally {
      setBusy("");
    }
  };
  const patch = (changes: Partial<Project>) =>
    setProject((p) => ({ ...p, ...changes }));
  const updateRules = (key: string, value: any) =>
    setProject((p) => ({ ...p, rules: { ...p.rules, [key]: value } }));
  const updateLaunch = (key: string, value: any) =>
    setProject((p) => ({ ...p, launch: { ...p.launch, [key]: value } }));
  const updatePalette = (key: string, value: any) =>
    setProject((p) => ({ ...p, palette: { ...p.palette, [key]: value } }));
  const updateExport = (key: string, value: any) =>
    setProject((p) => ({ ...p, export: { ...p.export, [key]: value } }));
  const usesReplays = project.kind === "comparison";
  const multiReplay = usesReplays;
  const scenarioChange = (kind: string) => {
    setProject((p) => ({
      ...p,
      kind,
      mapHash:
        kind === "comparison"
          ? (state.replays.find((r) => p.replayIds.includes(r.id))?.mapHash ??
            "")
          : p.mapHash,
      visualization: kind === "comparison" ? p.visualization : kind,
      launch:
        kind === "comparison" ? { ...p.launch, mods: "", mods2: "" } : p.launch,
    }));
    setSection("Cursor");
  };
  const selected = state.replays.filter((r) =>
    project.replayIds.includes(r.id),
  );
  const colors = assignColors(selected, project.palette);
  const map = state.maps.find((m) => m.hash === project.mapHash);
  const visible = [...state.replays].sort(
    (a, b) =>
      (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0) ||
      a.id.localeCompare(b.id),
  );
  const chooseReplay = (r: Replay, checked: boolean) => {
    if (
      checked &&
      selected.length &&
      selected.some((s) => s.mapHash !== r.mapHash)
    ) {
      setNotice({
        text: t(
          "Для одной сцены выберите попытки одной карты. Загрузите попытки одной карты.",
        ),
        error: true,
      });
      return;
    }
    patch({
      replayIds: checked
        ? [...project.replayIds, r.id]
        : project.replayIds.filter((id) => id !== r.id),
      ...(checked ? { mapHash: r.mapHash } : {}),
    });
    if (checked && !state.maps.some((m) => m.hash === r.mapHash))
      void perform(t("Ищем точную карту в lazer…"), async () => {
        await api("/maps/resolve", "POST", { hash: r.mapHash });
        await refresh();
      });
  };
  const selectAll = () => {
    const hash = project.mapHash || visible[0]?.mapHash;
    if (!hash) return;
    const same = visible.filter((r) => r.mapHash === hash);
    patch({
      mapHash: hash,
      replayIds: [...new Set([...project.replayIds, ...same.map((r) => r.id)])],
    });
  };
  const importResult = async (result: any) => {
    const s = await refresh();
    if (s.replays.length)
      setProject((p) => ({
        ...p,
        mapHash: s.replays[0].mapHash,
        replayIds: s.replays.map((r: Replay) => r.id),
      }));
    setNotice({
      text:
        t("Добавлено: {count}. Дубликатов: {duplicates}.", {
          count: result.imported.length,
          duplicates: result.duplicates.length,
        }) +
        `${result.errors.length ? t(" Ошибки: ") + result.errors.map((e: any) => `${e.file}: ${e.error}`).join("; ") : ""}${result.mapErrors?.length ? t(" Карты не найдены для ") + result.mapErrors.length + t(" подборок. Настройте Songs или lazer.") : ""}`,
      error: Boolean(result.errors.length || result.mapErrors?.length),
    });
  };
  const importReplays = (files: FileList | File[]) =>
    perform(t("Читаем реплеи…"), async () => {
      const form = new FormData();
      for (const f of Array.from(files)) form.append("files", f);
      await importResult(await api("/import", "POST", form));
    });
  const run = (action: string) =>
    perform(t("Проверяем и запускаем…"), async () => {
      await api("/jobs", "POST", {
        project: {
          ...project,
          name: project.name.trim() || map?.title || "Danser video",
          replayIds: usesReplays ? project.replayIds : [],
        },
        action,
      });
      setPage("queue");
      await refresh();
    });
  const getAt = (keys: string[]) =>
    keys.reduce((v, k) => v?.[k], project.configPatch as any);
  const setAt = (keys: string[], value: any) =>
    setProject((p) => {
      const data = structuredClone(p.configPatch);
      let current = data;
      for (const key of keys.slice(0, -1)) current = current[key] ??= {};
      if (value === undefined) delete current[keys.at(-1)!];
      else current[keys.at(-1)!] = value;
      return { ...p, configPatch: data };
    });
  const renderFields = (
    fields: Field[],
    prefix: string[] = [],
    depth = 0,
  ): React.ReactNode =>
    fields.map((field) => {
      if (
        prefix[0] === "Knockout" &&
        ["MaxPlayers", "ExcludeMods"].includes(field.key)
      )
        return null;
      const keys = [...prefix, field.key],
        key = keys.join("."),
        value = getAt(keys),
        match = `${key} ${field.tags.label || ""} ${field.description}`
          .toLowerCase()
          .includes(settingsSearch.toLowerCase());
      if (field.children && !field.array)
        return (
          <div className="schema-group" key={key}>
            <h3>{field.tags.label || field.name}</h3>
            {renderFields(field.children, keys, depth + 1)}
          </div>
        );
      if (!match) return null;
      const options =
        field.tags.combo === "true"
          ? []
          : (field.tags.combo?.split(",").filter((o) => o !== "custom") ?? []);
      const isNumber =
        /^(float|int|uint)/.test(field.type) || field.type === "KnockoutMode";
      const label =
        field.tags.label || field.name.replace(/([a-z])([A-Z])/g, "$1 $2");
      const advanced =
        field.array ||
        (!["string", "bool", "KnockoutMode"].includes(field.type) && !isNumber);
      return (
        <div className="schema-field" key={key}>
          <div>
            <label htmlFor={key}>{label}</label>
            <code>{key}</code>
            {field.description && <small>{field.description}</small>}
            {field.tags.showif && (
              <small className="muted">
                {t("Условие движка:")}
                {field.tags.showif}
              </small>
            )}
            {field.tags.skip === "true" && (
              <small className="warning">
                {t(
                  "Служебное, устаревшее или не реализованное поле — проверяйте описание.",
                )}
              </small>
            )}
          </div>
          <div className="schema-control">
            {advanced ? (
              <textarea
                id={key}
                defaultValue={
                  value === undefined ? "" : JSON.stringify(value, null, 2)
                }
                key={`${key}-${JSON.stringify(value)}`}
                placeholder={t("JSON · по умолчанию движка")}
                onBlur={(e) => {
                  try {
                    setAt(
                      keys,
                      e.target.value.trim()
                        ? JSON.parse(e.target.value)
                        : undefined,
                    );
                  } catch {
                    setNotice({
                      text: t("Некорректный JSON: {key}", { key }),
                      error: true,
                    });
                  }
                }}
              />
            ) : field.type === "bool" ? (
              <select
                id={key}
                value={value === undefined ? "" : String(value)}
                onChange={(e) =>
                  setAt(
                    keys,
                    e.target.value === ""
                      ? undefined
                      : e.target.value === "true",
                  )
                }
              >
                <option value="">{t("По умолчанию движка")}</option>
                <option value="true">{t("Включено")}</option>
                <option value="false">{t("Выключено")}</option>
              </select>
            ) : options.length ? (
              <>
                <select
                  id={key}
                  value={value ?? ""}
                  onChange={(e) =>
                    setAt(
                      keys,
                      e.target.value === ""
                        ? undefined
                        : isNumber
                          ? Number(e.target.value)
                          : e.target.value,
                    )
                  }
                >
                  <option value="">{t("По умолчанию движка")}</option>
                  {options.map((o) => {
                    const [v, l] = o.split("|");
                    return (
                      <option key={v} value={v}>
                        {l || v}
                      </option>
                    );
                  })}
                </select>
                {field.tags.combo?.includes("custom") && (
                  <input
                    aria-label={`${label}: своё значение`}
                    type="number"
                    value={value ?? ""}
                    placeholder={t("Своё значение")}
                    onChange={(e) =>
                      setAt(
                        keys,
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                      )
                    }
                  />
                )}
              </>
            ) : (
              <input
                id={key}
                type={
                  field.tags.password === "true"
                    ? "password"
                    : isNumber
                      ? "number"
                      : "text"
                }
                step="any"
                min={field.tags.min}
                max={field.tags.max}
                value={value ?? ""}
                placeholder={t("По умолчанию движка")}
                onChange={(e) =>
                  setAt(
                    keys,
                    e.target.value === ""
                      ? undefined
                      : isNumber
                        ? Number(e.target.value)
                        : e.target.value,
                  )
                }
              />
            )}
            <button
              className="icon-btn"
              title={t("Вернуть значение движка")}
              onClick={() => setAt(keys, undefined)}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      );
    });
  const engineReady =
    health?.engine && !!map && (project.kind !== "comparison" || health.studio);
  const paletteCss = `linear-gradient(90deg,${(project.palette.reverse ? [...project.palette.stops].reverse() : project.palette.stops).join(",")})`;
  return (
    <div className={`studio-app workspace-${page}`}>
      <header className="studio-header">
        <a
          className="studio-brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("library");
          }}
        >
          <Activity size={27} />
          <span>
            danser<b>studio</b>
          </span>
        </a>
        <nav aria-label={t("Разделы приложения")}>
          {[
            { id: "library", icon: DiscIcon, label: t("Создать") },
            { id: "queue", icon: Clapperboard, label: t("Очередь") },
            { id: "settings", icon: Settings2, label: t("Подключение") },
          ].map((item) => (
            <button
              key={item.id}
              aria-current={page === item.id ? "page" : undefined}
              onClick={() => setPage(item.id)}
            >
              <item.icon size={18} />
              {t(item.label)}
              {item.id === "queue" &&
                state.jobs.some((j) =>
                  ["running", "queued"].includes(j.status),
                ) && (
                  <span className="queue-count">
                    {
                      state.jobs.filter((j) =>
                        ["running", "queued"].includes(j.status),
                      ).length
                    }
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="header-tools">
          <span className="engine-indicator">
            <i className={health?.engine ? "green" : ""} />
            {health?.engine ? t("Danser готов") : t("Настройте Danser")}
          </span>
          <label className="language-picker">
            <span className="sr-only">{t("Язык")}</span>
            <select
              aria-label={t("Язык")}
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value as Language);
                changeLanguage(e.target.value as Language);
              }}
            >
              <option value="ru">RU</option>
              <option value="en">EN</option>
            </select>
          </label>
        </div>
      </header>
      {notice && (
        <div
          role={notice.error ? "alert" : "status"}
          className={`toast ${notice.error ? "error" : ""}`}
        >
          <span>{t(notice.text)}</span>
          <button
            className="icon-btn"
            aria-label={t("Закрыть уведомление")}
            onClick={() => setNotice(null)}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {busy && (
        <div className="busy-pill" role="status">
          <LoaderCircle className="spin" size={16} />
          {t(busy)}
        </div>
      )}
      <main className="studio-layout">
        <div className="source-rail" key={`source-${page}`}>
          {page === "library" && (
            <>
              <h2>{t("Источник")}</h2>
              <div className="scenario-tabs">
                <button
                  aria-pressed={usesReplays}
                  onClick={() => scenarioChange("comparison")}
                >
                  {t("Реплеи")}
                </button>
                <button
                  aria-pressed={!usesReplays}
                  onClick={() =>
                    scenarioChange(project.visualization ?? "dance")
                  }
                >
                  {t("Карта")}
                </button>
              </div>
              {usesReplays ? (
                <>
                  <div
                    className={`replay-drop ${dragging ? "dragging" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      void importReplays(e.dataTransfer.files);
                    }}
                  >
                    <Upload size={23} />
                    <h3>{t("Добавьте попытки")}</h3>
                    <p>{t("Перетащите .osr одной карты")}</p>
                    <button
                      className="button primary"
                      disabled={!!busy}
                      onClick={() => fileRef.current?.click()}
                    >
                      <Plus size={16} />
                      {t("Выбрать реплеи")}
                    </button>
                  </div>
                  <input
                    hidden
                    ref={fileRef}
                    type="file"
                    multiple
                    accept=".osr"
                    onChange={(e) => {
                      if (e.target.files) void importReplays(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <div className="attempt-heading">
                    <h3>
                      {t("Попытки")}{" "}
                      <span>
                        {selected.length}/{state.replays.length}
                      </span>
                    </h3>
                    <button className="text-button" onClick={selectAll}>
                      {t("Все")}
                    </button>
                    <button
                      className="text-button"
                      onClick={() => patch({ replayIds: [] })}
                    >
                      {t("Снять")}
                    </button>
                  </div>
                  <div className="attempt-list">
                    {visible.map((r) => (
                      <div
                        className={`attempt ${project.replayIds.includes(r.id) ? "selected" : ""}`}
                        key={r.id}
                      >
                        <label className="attempt-select">
                          <input
                            type="checkbox"
                            checked={project.replayIds.includes(r.id)}
                            onChange={(e) => chooseReplay(r, e.target.checked)}
                          />
                          <span>
                            <b>{r.player}</b>
                            <small>
                              {fmtDate(r.date)} ·{" "}
                              {r.modList.join(" ") || "No Mod"}
                            </small>
                          </span>
                        </label>
                        <input
                          className="swatch"
                          aria-label={`${t("Цвет")} ${r.player}`}
                          type="color"
                          disabled={!colors[r.id]}
                          value={colors[r.id] || "#9198a8"}
                          onChange={(e) =>
                            updatePalette("overrides", {
                              ...project.palette.overrides,
                              [r.id]: e.target.value,
                            })
                          }
                        />
                        <details>
                          <summary>
                            {r.accuracy.toFixed(2)}% · {num(r.combo)}x
                          </summary>
                          <p>{r.filename}</p>
                          <p>
                            {t("Счёт")}: {num(r.score)} · {t("Промахи")}:{" "}
                            {r.misses}
                          </p>
                          <FieldLabel label={t("Группа")}>
                            <input
                              defaultValue={r.group}
                              onBlur={(e) => {
                                if (e.target.value !== r.group)
                                  void perform(
                                    t("Сохраняем группу…"),
                                    async () => {
                                      await api("/replays/" + r.id, "PATCH", {
                                        group: e.target.value,
                                      });
                                      await refresh();
                                    },
                                  );
                              }}
                            />
                          </FieldLabel>
                          <button
                            className="text-button"
                            onClick={() => {
                              const overrides = {
                                ...project.palette.overrides,
                              };
                              delete overrides[r.id];
                              updatePalette("overrides", overrides);
                            }}
                          >
                            {t("Снять ручной цвет")}
                          </button>
                        </details>
                      </div>
                    ))}
                    {!visible.length && (
                      <p className="note">
                        {state.replays.length
                          ? t("Нет попыток с этими фильтрами")
                          : t(
                              "Ники, даты и цвета появятся здесь после загрузки",
                            )}
                      </p>
                    )}
                  </div>
                  <button
                    className="text-button"
                    disabled={
                      !!busy ||
                      state.jobs.some((j) =>
                        ["queued", "running"].includes(j.status),
                      )
                    }
                    onClick={() =>
                      perform(t("Очищаем реплеи…"), async () => {
                        await api("/replays", "DELETE");
                        patch({ replayIds: [], mapHash: "" });
                        await refresh();
                      })
                    }
                  >
                    <RefreshCw size={14} />
                    {t("Новый рендер")}
                  </button>
                </>
              ) : (
                <FieldLabel label={t("Визуализация")}>
                  <select
                    value={project.kind}
                    onChange={(e) => scenarioChange(e.target.value)}
                  >
                    <option value="dance">Cursor Dance</option>
                    <option value="autoplay">Autoplay</option>
                  </select>
                </FieldLabel>
              )}
              <section className="workflow-card map-summary">
                <h2>
                  {usesReplays ? t("Карта из реплея") : t("Карта для видео")}
                </h2>
                {!usesReplays && (
                  <FieldLabel label={t("Карта и сложность")}>
                    <input
                      aria-label={t("Поиск карт")}
                      placeholder={t("Название, исполнитель или сложность")}
                      value={mapSearch}
                      onChange={(e) => setMapSearch(e.target.value)}
                    />
                    <select
                      aria-label={t("Карта и сложность")}
                      value={project.mapHash}
                      onChange={(e) => patch({ mapHash: e.target.value })}
                    >
                      <option value="">{t("Выберите карту")}</option>
                      {state.maps
                        .filter(
                          (m) =>
                            m.hash === project.mapHash ||
                            `${m.title} ${m.artist} ${m.difficulty}`
                              .toLowerCase()
                              .includes(mapSearch.toLowerCase()),
                        )
                        .map((m) => (
                          <option key={m.hash} value={m.hash}>
                            {m.artist} — {m.title} [{m.difficulty}]
                          </option>
                        ))}
                    </select>
                  </FieldLabel>
                )}
                <p>
                  {map
                    ? `${map.artist} — ${map.title} [${map.difficulty}]`
                    : project.mapHash
                      ? t("Точная версия карты не найдена")
                      : usesReplays
                        ? t(
                            "Загрузите реплеи — карта определится автоматически",
                          )
                        : t(
                            "Выберите карту из Songs / lazer или импортируйте .osz",
                          )}
                </p>
                {project.mapHash && <small>MD5: {project.mapHash}</small>}
                {project.mapHash && !map && (
                  <p className="warning">
                    {t(
                      "Подключите Songs / lazer или импортируйте .osz с этой версией карты.",
                    )}
                  </p>
                )}
                <div className="job-actions">
                  <button
                    className="text-button"
                    disabled={!!busy || !project.mapHash}
                    onClick={() =>
                      perform(t("Ищем карту…"), async () => {
                        await api("/maps/resolve", "POST", {
                          hash: project.mapHash,
                        });
                        await refresh();
                      })
                    }
                  >
                    {t("Повторить поиск")}
                  </button>
                  <button
                    className="button ghost"
                    disabled={!!busy}
                    onClick={() => mapRef.current?.click()}
                  >
                    {t("Импорт .osz")}
                  </button>
                </div>
                <input
                  hidden
                  type="file"
                  accept=".osz"
                  ref={mapRef}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      perform(t("Импортируем карту…"), async () => {
                        const form = new FormData();
                        form.append("file", f);
                        const imported = await api(
                          "/maps/import",
                          "POST",
                          form,
                        );
                        await refresh();
                        if (!usesReplays && imported.maps?.length)
                          patch({ mapHash: imported.maps[0].hash });
                        if (usesReplays && project.mapHash)
                          await api("/maps/resolve", "POST", {
                            hash: project.mapHash,
                          });
                      });
                    e.target.value = "";
                  }}
                />
              </section>
            </>
          )}
          {page === "queue" && (
            <>
              <div className="page-heading">
                <h1>{t("Очередь")}</h1>
                <p>
                  {t(
                    "Задания выполняются по очереди. Настройки сохраняются в текущей сессии.",
                  )}
                </p>
              </div>
              <div className="jobs">
                {[...state.jobs]
                  .sort(
                    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
                  )
                  .map((j) => (
                    <div className="job-card" key={j.id}>
                      <div className="job-icon">
                        <Clapperboard size={22} />
                      </div>
                      <div className="job-body">
                        <div>
                          <h3>{j.name}</h3>
                          <span className={`job-status ${j.status}`}>
                            {
                              (
                                {
                                  queued: t("В очереди"),
                                  running: t("Рендеринг"),
                                  completed: t("Готово"),
                                  failed: t("Ошибка"),
                                  cancelled: t("Отменено"),
                                  interrupted: t("Прервано"),
                                } as Record<string, string>
                              )[j.status]
                            }
                          </span>
                        </div>
                        <p>
                          {
                            (
                              {
                                record: t("Видео"),
                                preview: t("Предпросмотр 10 секунд"),
                                screenshot: t("Снимок"),
                                watch: t("Окно просмотра"),
                              } as Record<string, string>
                            )[j.action]
                          }{" "}
                          · {fmtDate(j.createdAt)}
                        </p>
                        {j.status === "running" && (
                          <div className="progress">
                            <i style={{ width: j.progress + "%" }} />
                            <span>{j.progress}%</span>
                          </div>
                        )}
                        {j.error && <p className="warning">{j.error}</p>}
                        <div className="job-actions">
                          <button
                            className="text-button"
                            onClick={() => setSelectedJob(j)}
                          >
                            {t("Журнал")}
                          </button>
                          {["queued", "running"].includes(j.status) ? (
                            <button
                              className="text-button danger"
                              onClick={() =>
                                perform(t("Отменяем…"), async () => {
                                  await api(
                                    "/jobs/" + j.id + "/cancel",
                                    "POST",
                                  );
                                  await refresh();
                                })
                              }
                            >
                              {t("Отменить")}
                            </button>
                          ) : (
                            <button
                              className="text-button"
                              disabled={
                                j.action === "watch" || j.retryable === false
                              }
                              onClick={() =>
                                perform(t("Запускаем повторно…"), async () => {
                                  await api("/jobs/" + j.id + "/retry", "POST");
                                  await refresh();
                                })
                              }
                            >
                              {t("Повторить")}
                            </button>
                          )}
                          {j.status === "completed" && j.action !== "watch" && (
                            <>
                              <button
                                className="text-button"
                                onClick={() => setSelectedJob(j)}
                              >
                                <Play size={14} />
                                {t("Посмотреть")}
                              </button>
                              <a
                                className="text-button"
                                href={`/api/jobs/${j.id}/output?download=1`}
                              >
                                <ArrowDownToLine size={14} />
                                {t("Сохранить файл")}
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
              {!state.jobs.length && (
                <div className="empty-library">
                  <Clapperboard size={35} />
                  <h3>{t("Пока без заданий")}</h3>
                  <p>{t("Подготовьте сцену и нажмите «Создать видео».")}</p>
                  <button
                    className="button ghost"
                    onClick={() => setPage("library")}
                  >
                    {t("Создать видео")}
                  </button>
                </div>
              )}
            </>
          )}
          {page === "settings" && (
            <>
              <div className="page-heading">
                <h1>
                  {t("Подключение")}
                  <span>.</span>
                </h1>
                <p>{t("Локальные пути сохраняются между сессиями.")}</p>
              </div>
              <div className="settings-panel">
                <LazerConnection
                  value={cfg.lazerDir ?? ""}
                  onChange={(v) => setCfg((c) => ({ ...c, lazerDir: v }))}
                  busy={!!busy}
                  onDetect={() =>
                    perform(t("Ищем хранилище lazer…"), async () => {
                      const found = await api("/lazer/detect");
                      if (!found.path)
                        throw new Error(
                          t(
                            "Стандартная папка lazer не найдена. Укажите её вручную.",
                          ),
                        );
                      setCfg((c) => ({ ...c, lazerDir: found.path }));
                    })
                  }
                  onConnect={() =>
                    perform(t("Читаем индекс lazer…"), async () => {
                      await api("/config", "PUT", cfg);
                      const result = await api("/maps/scan", "POST");
                      await refresh();
                      setHealth(await api("/health"));
                      setNotice({
                        text: t(
                          "Индекс обновлён: {maps} карт. Ошибок: {errors}",
                          {
                            maps: result.maps.length,
                            errors: result.errors.length,
                          },
                        ),
                        error: !!result.errors.length,
                      });
                    })
                  }
                />
                <h2>{t("Окружение")}</h2>
                <div className="health-grid">
                  {[
                    ["engine", "Danser"],
                    ["studio", t("Цвета реплеев")],
                    ["ffmpeg", "FFmpeg"],
                    ["songs", "Songs"],
                    ["lazer", "osu!lazer"],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <i className={health?.[key] ? "green" : ""} />
                      <span>{label}</span>
                      <small>
                        {health?.[key] ? t("Готово") : t("Не настроено")}
                      </small>
                    </div>
                  ))}
                </div>
                {[
                  [
                    "enginePath",
                    t("Исполняемый файл danser"),
                    "D:\\…\\danser-studio.exe",
                  ],
                  ["outputDir", t("Готовые видео"), "D:\\Videos"],
                  [
                    "ffmpegPath",
                    "FFmpeg",
                    t("ffmpeg или полный путь к ffmpeg.exe"),
                  ],
                ].map(([key, label, placeholder]) => (
                  <FieldLabel key={key} label={label}>
                    <input
                      value={(cfg as any)[key]}
                      placeholder={placeholder}
                      onChange={(e) =>
                        setCfg((c) => ({ ...c, [key]: e.target.value }))
                      }
                    />
                  </FieldLabel>
                ))}
                <details className="schema-group">
                  <summary>
                    {t("Дополнительные папки: osu!stable и локальные скины")}
                  </summary>
                  <p className="note">
                    {t(
                      "Для lazer эти пути не нужны. Его files не является папкой Songs или Skins. Оставьте поля пустыми, если используете только lazer и импорт .osk.",
                    )}
                  </p>
                  {[
                    [
                      "songsDir",
                      t("Songs osu!stable (необязательно)"),
                      "D:\\osu!\\Songs",
                    ],
                    [
                      "skinsDir",
                      t("Локальная папка скинов / .osk (необязательно)"),
                      "D:\\osu!\\Skins",
                    ],
                  ].map(([key, label, placeholder]) => (
                    <FieldLabel key={key} label={label}>
                      <input
                        value={(cfg as any)[key]}
                        placeholder={placeholder}
                        onChange={(e) =>
                          setCfg((c) => ({ ...c, [key]: e.target.value }))
                        }
                      />
                    </FieldLabel>
                  ))}
                </details>
                <p className="note">
                  {t(
                    "Для закреплённых цветов используйте сборку danser-studio из этого проекта. Оригинальный danser поддерживает остальные сценарии. Папка реплеев приложения хранится отдельно от внутренней папки danser.",
                  )}
                </p>
                <button
                  className="button primary"
                  disabled={!!busy}
                  onClick={() =>
                    perform(t("Проверяем окружение…"), async () => {
                      await api("/config", "PUT", cfg);
                      await refresh();
                      await loadSkins();
                      setHealth(await api("/health"));
                      setNotice({
                        text: t("Пути сохранены, проверка завершена"),
                        error: false,
                      });
                    })
                  }
                >
                  <Check size={16} />
                  {t("Сохранить и проверить")}
                </button>
                <CredentialsPanel />
              </div>
            </>
          )}
        </div>
        <VinylStage map={map} />
        <aside className="scene-rail" key={`scene-${page}`}>
          {page === "library" ? (
            <>
              <h2>{t("Оформление сцены")}</h2>
              <div className="scene-tabs">
                {[
                  { id: "rules", label: t("Режим") },
                  { id: "colors", label: t("Курсоры") },
                  { id: "skin", label: t("Скин") },
                ].map((tab) => (
                  <button
                    aria-pressed={sceneTab === tab.id}
                    key={tab.id}
                    onClick={() => setSceneTab(tab.id)}
                  >
                    {t(tab.label)}
                  </button>
                ))}
              </div>
              {sceneTab === "rules" && (
                <>
                  {usesReplays ? (
                    <RulesPanel project={project} updateRules={updateRules} />
                  ) : (
                    <p className="note">
                      {project.kind === "dance"
                        ? t(
                            "Cursor Dance создаёт движение курсоров без реплеев",
                          )
                        : t(
                            "Autoplay показывает автоматическое прохождение с игровым интерфейсом",
                          )}
                    </p>
                  )}
                  <details className="launch-disclosure">
                    <summary>{t("Параметры прохождения")}</summary>
                    <LaunchPanel
                      project={project}
                      patch={patch}
                      updateLaunch={updateLaunch}
                    />
                  </details>
                </>
              )}
              {sceneTab === "colors" &&
                (usesReplays ? (
                  <PalettePanel
                    project={project}
                    selected={selected}
                    updatePalette={updatePalette}
                    paletteCss={paletteCss}
                  />
                ) : (
                  <>
                    <p className="note">
                      {t(
                        "Цвета автоматических курсоров настраиваются в разделе Cursor движка",
                      )}
                    </p>
                    <button
                      className="button ghost"
                      onClick={() => {
                        setSection("Cursor");
                        document.querySelector<HTMLDetailsElement>(
                          ".advanced",
                        )!.open = true;
                        document
                          .querySelector(".advanced")
                          ?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      {t("Настроить Cursor")}
                    </button>
                  </>
                ))}
              {sceneTab === "skin" && (
                <>
                  <section className="workflow-card">
                    <h2>{t("Скин")}</h2>
                    <FieldLabel label={t("Выбранный скин")}>
                      <select
                        value={project.launch.skinId ?? ""}
                        onChange={(e) => updateLaunch("skinId", e.target.value)}
                      >
                        <option value="">{t("Встроенный скин danser")}</option>
                        {skins.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </FieldLabel>
                    <p className="note">
                      {t(
                        "Папки и архивы .osk из директории Skins в подключении. Можно импортировать отдельный архив.",
                      )}
                    </p>
                    <div className="job-actions">
                      <button
                        className="button ghost"
                        disabled={!!busy}
                        onClick={() => skinRef.current?.click()}
                      >
                        {t("Импорт .osk")}
                      </button>
                      <button
                        className="text-button"
                        disabled={!!busy}
                        onClick={() => perform(t("Читаем скины…"), loadSkins)}
                      >
                        {t("Обновить список")}
                      </button>
                    </div>
                    <input
                      hidden
                      type="file"
                      accept=".osk"
                      ref={skinRef}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f)
                          perform(t("Импортируем скин…"), async () => {
                            const form = new FormData();
                            form.append("file", f);
                            const result = await api(
                              "/skins/import",
                              "POST",
                              form,
                            );
                            await loadSkins();
                            updateLaunch("skinId", result.id);
                          });
                        e.target.value = "";
                      }}
                    />
                  </section>
                </>
              )}
              <p className="session-note">
                {t("Настройки сохраняются в этой вкладке")}
              </p>
            </>
          ) : page === "queue" ? (
            <>
              <h2>{t("Состояние рендера")}</h2>
              <p className="note">
                {t(
                  "Видео и превью выполняются по очереди. Пластинку можно слушать во время рендера.",
                )}
              </p>
              <p className="note">
                {t(
                  "После успешного полного видео загруженные копии реплеев удаляются. Превью, ошибка и отмена сохраняют попытки.",
                )}
              </p>
              <button
                className="button ghost"
                onClick={() => setPage("library")}
              >
                {t("Вернуться к сцене")}
              </button>
            </>
          ) : (
            <>
              <h2>{t("Ваши файлы остаются локальными")}</h2>
              <p className="note">
                {t(
                  "Хранилище lazer открывается только для чтения. Музыка и фон берутся из выбранной версии карты.",
                )}
              </p>
              <a
                className="text-button"
                href="https://github.com/Wieku/danser-go"
                target="_blank"
                rel="noreferrer"
              >
                danser-go / Wieku
              </a>
            </>
          )}
        </aside>
      </main>
      {page === "library" && (
        <>
          <footer className="export-dock">
            <FieldLabel label={t("Название видео")}>
              <input
                placeholder={map?.title || t("Необязательно")}
                value={project.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </FieldLabel>
            <FieldLabel label={t("Пресет видео")}>
              <select
                value={`${project.export.width}x${project.export.height}x${project.export.fps}`}
                onChange={(e) => {
                  const [width, height, fps] = e.target.value
                    .split("x")
                    .map(Number);
                  patch({ export: { ...project.export, width, height, fps } });
                }}
              >
                <option value="1920x1080x60">1080p / 60 fps</option>
                <option value="2560x1440x60">1440p / 60 fps</option>
                <option value="1280x720x30">720p / 30 fps</option>
                <option value="3840x2160x60">4K / 60 fps</option>
                <option
                  value={`${project.export.width}x${project.export.height}x${project.export.fps}`}
                >
                  {t("Текущие значения")}
                </option>
              </select>
            </FieldLabel>
            <button
              className="text-button"
              aria-expanded={showExport}
              onClick={() => setShowExport(!showExport)}
            >
              <SlidersHorizontal size={16} />
              {t("Экспорт")}
            </button>
            <div className="render-actions">
              <button
                className="button ghost"
                disabled={
                  !!busy ||
                  !engineReady ||
                  !health?.ffmpeg ||
                  (usesReplays && !selected.length)
                }
                onClick={() => run("preview")}
              >
                <Play size={16} />
                {t("Превью · 10 с")}
              </button>
              <button
                className="button primary"
                disabled={
                  !!busy ||
                  !engineReady ||
                  !health?.ffmpeg ||
                  (usesReplays && !selected.length)
                }
                onClick={() => run("record")}
              >
                <Clapperboard size={17} />
                {t("Создать видео")}
              </button>
            </div>
            {(!engineReady || !health?.ffmpeg) && (
              <p className="render-requirement">
                {!health?.engine
                  ? t("Подключите Danser в настройках")
                  : !map
                    ? t("Выберите точную карту для видео")
                    : !health?.ffmpeg
                      ? t("Подключите FFmpeg для записи видео")
                      : t("Для реплеев нужна сборка danser-studio")}
              </p>
            )}
          </footer>
          {showExport && (
            <div className="export-expanded">
              <ExportPanel
                project={project}
                patch={patch}
                updateExport={updateExport}
                updateLaunch={updateLaunch}
                busy={busy}
                engineReady={engineReady}
                run={run}
              />
            </div>
          )}
          <details className="workflow-card advanced">
            <summary>{t("Все настройки движка")}</summary>
            <div className="settings-layout">
              <div className="settings-nav">
                {schema
                  .filter(
                    (s) =>
                      s.key !== "Credentials" &&
                      s.key !== "Input" &&
                      (s.key !== "CursorDance" ||
                        ["dance", "autoplay"].includes(project.kind)) &&
                      (s.key !== "Knockout" || multiReplay),
                  )
                  .map((s) => (
                    <button
                      key={s.key}
                      className={section === s.key ? "active" : ""}
                      onClick={() => setSection(s.key)}
                    >
                      {t(labels[s.key] || s.key)}
                    </button>
                  ))}
              </div>
              <div className="settings-panel">
                <div className="settings-title">
                  <h2>{t(labels[section] || section)}</h2>
                  <button
                    className="text-button"
                    onClick={() => {
                      setJsonMode((v) => !v);
                      setJsonText(JSON.stringify(project.configPatch, null, 2));
                    }}
                  >
                    <SlidersHorizontal size={14} />
                    {jsonMode ? t("Поля настроек") : "JSON"}
                  </button>
                </div>
                <div className="search full">
                  <Search size={16} />
                  <input
                    placeholder={t("Поиск по названию или JSON-пути…")}
                    value={settingsSearch}
                    onChange={(e) => setSettingsSearch(e.target.value)}
                  />
                </div>
                <div className="note">
                  {t("Пустое поле использует значение движка.")}{" "}
                  {[
                    "General",
                    "Recording",
                    "Knockout",
                    "Graphics",
                    "Cursor",
                  ].includes(section) &&
                    t(
                      "Пути, экспорт, выбывание и закреплённая палитра уточняются основными параметрами перед рендером.",
                    )}
                </div>
                <button
                  className="text-button"
                  onClick={() => configRef.current?.click()}
                >
                  <Upload size={14} />
                  {t("Импортировать профиль настроек")}
                </button>
                <input
                  hidden
                  ref={configRef}
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      perform(t("Импортируем настройки…"), async () => {
                        const data = JSON.parse(await f.text());
                        if (
                          !data ||
                          typeof data !== "object" ||
                          Array.isArray(data)
                        )
                          throw new Error(t("Ожидается JSON-объект"));
                        delete data.Credentials;
                        patch({ configPatch: data });
                        setJsonText(JSON.stringify(data, null, 2));
                      });
                    e.target.value = "";
                  }}
                />
                {jsonMode ? (
                  <>
                    <textarea
                      className="json-editor"
                      aria-label={t("JSON настроек движка")}
                      value={jsonText}
                      onChange={(e) => setJsonText(e.target.value)}
                      spellCheck={false}
                    />
                    <button
                      className="button primary"
                      onClick={() => {
                        try {
                          const data = JSON.parse(jsonText);
                          if (
                            !data ||
                            Array.isArray(data) ||
                            typeof data !== "object"
                          )
                            throw new Error(t("Ожидается JSON-объект"));
                          if (data.Credentials)
                            throw new Error(
                              t("Авторизацию настраивайте в подключении"),
                            );
                          patch({ configPatch: data });
                          setNotice({
                            text: t("Настройки применены к рендеру"),
                            error: false,
                          });
                        } catch (e) {
                          setNotice({
                            text: (e as Error).message,
                            error: true,
                          });
                        }
                      }}
                    >
                      {t("Применить JSON")}
                    </button>
                  </>
                ) : (
                  renderFields(
                    schema.find((s) => s.key === section)?.children ?? [],
                    [section],
                  )
                )}
              </div>
            </div>
          </details>
        </>
      )}
      {selectedJob && (
        <dialog
          ref={jobDialog}
          className="modal"
          aria-labelledby="job-dialog-title"
          onCancel={() => setSelectedJob(null)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedJob(null);
          }}
        >
          <div className="settings-title">
            <h2 id="job-dialog-title">{selectedJob.name}</h2>
            <button
              autoFocus
              className="icon-btn"
              aria-label={t("Закрыть журнал")}
              onClick={() => setSelectedJob(null)}
            >
              <X size={20} />
            </button>
          </div>
          {selectedJob.status === "completed" &&
            selectedJob.action !== "watch" &&
            (selectedJob.action === "screenshot" ? (
              <img
                className="output-image"
                alt={t("Снимок рендера")}
                src={`/api/jobs/${selectedJob.id}/output`}
              />
            ) : (
              <video controls src={`/api/jobs/${selectedJob.id}/output`} />
            ))}
          <h3>{t("Журнал задания")}</h3>
          <pre>
            {state.jobs.find((j) => j.id === selectedJob.id)?.log ||
              t("Задание ещё не запущено")}
          </pre>
        </dialog>
      )}
      <div className="studio-credit">
        <span>Danser Studio · osu!standard</span>
        <a
          href="https://github.com/Wieku/danser-go"
          target="_blank"
          rel="noreferrer"
        >
          Powered by danser-go
        </a>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
