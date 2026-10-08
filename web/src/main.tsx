import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowDownToLine,
  Check,
  CircleHelp,
  Clapperboard,
  Clock3,
  Film,
  FolderOpen,
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
  name: "Прогресс тренировок",
  kind: "comparison",
  mapHash: "",
  replayIds: [],
  palette: {
    mode: "date",
    spacing: "rank",
    stops: ["#f06b78", "#f5cf76", "#a4e878"],
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
    encoder: "libx264",
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
  configPatch: {},
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
    throw new Error(data.error || "Не удалось выполнить запрос");
  return data;
};
const fmtDate = (date: string | null) =>
  date
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(date))
    : "Дата неизвестна";
const num = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
function App() {
  const [state, setState] = useState<State>(emptyState),
    [page, setPage] = useState("library"),
    [project, setProject] = useState<Project>(() => {
      try {
        const saved = sessionStorage.getItem("studio-render-settings");
        return saved
          ? {
              ...freshProject(),
              ...JSON.parse(saved),
              replayIds: [],
              mapHash: "",
            }
          : freshProject();
      } catch {
        return freshProject();
      }
    }),
    [search, setSearch] = useState(""),
    [mapFilter, setMapFilter] = useState(""),
    [playerFilter, setPlayerFilter] = useState(""),
    [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState(""),
    [sort, setSort] = useState("new"),
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
    [folder, setFolder] = useState(""),
    [showFolder, setShowFolder] = useState(false),
    [cfg, setCfg] = useState<Config>(emptyState.config),
    [groupFilter, setGroupFilter] = useState(""),
    [skins, setSkins] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    const { id, replayIds, mapHash, ...settings } = project;
    sessionStorage.setItem("studio-render-settings", JSON.stringify(settings));
  }, [project]);
  const fileRef = useRef<HTMLInputElement>(null),
    mapRef = useRef<HTMLInputElement>(null),
    skinRef = useRef<HTMLInputElement>(null),
    configRef = useRef<HTMLInputElement>(null);
  const loadSkins = async () => setSkins(await api("/skins"));
  const refresh = async () => {
    const s = await api("/state");
    setState(s);
    setProject((p) => {
      const ids = p.replayIds.filter((id) =>
        s.replays.some((r: Replay) => r.id === id),
      );
      return { ...p, replayIds: ids, mapHash: ids.length ? p.mapHash : "" };
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
            mapHash: s.replays[0].mapHash,
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
        text: `Не удалось прочитать скины: ${e.message}`,
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
  const selected = state.replays.filter((r) =>
    project.replayIds.includes(r.id),
  );
  const colors = assignColors(selected, project.palette);
  const map = state.maps.find((m) => m.hash === project.mapHash);
  const players = [...new Set(state.replays.map((r) => r.player))].sort();
  const groups = [
    ...new Set(state.replays.map((r) => r.group).filter(Boolean)),
  ].sort();
  const visible = state.replays
    .filter(
      (r) =>
        (!mapFilter || r.mapHash === mapFilter) &&
        (!playerFilter || r.player === playerFilter) &&
        (!groupFilter || r.group === groupFilter) &&
        (!dateFrom || (r.date && r.date.slice(0, 10) >= dateFrom)) &&
        (!dateTo || (r.date && r.date.slice(0, 10) <= dateTo)) &&
        `${r.player} ${r.filename} ${state.maps.find((m) => m.hash === r.mapHash)?.title || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "score"
        ? b.score - a.score
        : (sort === "old" ? 1 : -1) *
            ((a.date ? Date.parse(a.date) : 0) -
              (b.date ? Date.parse(b.date) : 0)) || a.id.localeCompare(b.id),
    );
  const chooseReplay = (r: Replay, checked: boolean) => {
    if (
      checked &&
      selected.length &&
      selected.some((s) => s.mapHash !== r.mapHash)
    ) {
      setNotice({
        text: "Для одной сцены выберите попытки одной карты. Загрузите попытки одной карты.",
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
      void perform("Ищем точную карту в lazer…", async () => {
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
      text: `Добавлено: ${result.imported.length}. Дубликатов: ${result.duplicates.length}.${result.errors.length ? " Ошибки: " + result.errors.map((e: any) => `${e.file}: ${e.error}`).join("; ") : ""}${result.mapErrors?.length ? " Карты не найдены для " + result.mapErrors.length + " подборок. Настройте Songs или lazer." : ""}`,
      error: Boolean(result.errors.length || result.mapErrors?.length),
    });
  };
  const importReplays = (files: FileList | File[]) =>
    perform("Читаем реплеи…", async () => {
      const form = new FormData();
      for (const f of Array.from(files)) form.append("files", f);
      await importResult(await api("/import", "POST", form));
    });
  const run = (action: string) =>
    perform("Проверяем и запускаем…", async () => {
      await api("/jobs", "POST", { project, action });
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
                Условие движка: {field.tags.showif}
              </small>
            )}
            {field.tags.skip === "true" && (
              <small className="warning">
                Служебное, устаревшее или не реализованное поле — проверяйте
                описание.
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
                placeholder="JSON · по умолчанию движка"
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
                      text: `Некорректный JSON: ${key}`,
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
                <option value="">По умолчанию движка</option>
                <option value="true">Включено</option>
                <option value="false">Выключено</option>
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
                  <option value="">По умолчанию движка</option>
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
                    placeholder="Своё значение"
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
                placeholder="По умолчанию движка"
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
              title="Вернуть значение движка"
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
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Activity size={25} />
          </div>
          <div>
            danser<span>STUDIO</span>
          </div>
        </div>
        <div className="workspace-label">ЛОКАЛЬНОЕ ПРОСТРАНСТВО</div>
        <nav>
          {[
            { id: "library", icon: Film, label: "Создать видео" },
            {
              id: "queue",
              icon: Clapperboard,
              label: "Рендеринг",
              count: state.jobs.filter((j) =>
                ["running", "queued"].includes(j.status),
              ).length,
            },
            { id: "settings", icon: Settings2, label: "Подключение" },
          ].map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => setPage(item.id)}
            >
              <item.icon size={19} />
              {item.label}
              {!!item.count && <b>{item.count}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-status">
            <i className={health?.engine ? "green" : ""} />
            <div>
              {health?.engine ? "Движок подключён" : "Подключите danser"}
              <small>Файлы остаются на компьютере</small>
            </div>
          </div>
          <button
            className="help-button"
            onClick={() => {
              setPage("settings");
              setSection("connection");
            }}
          >
            <CircleHelp size={17} />
            Настроить окружение
          </button>
          <span className="version">DANSER STUDIO / 0.1</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Рабочее пространство <span>/</span>{" "}
            <strong>
              {page === "library"
                ? "Создать видео"
                : page === "queue"
                  ? "Очередь рендеринга"
                  : "Настройки"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="local-badge">
              <i />
              Локально
            </span>
            <button
              className="button ghost small"
              disabled={
                !!busy ||
                !engineReady ||
                !health?.ffmpeg ||
                project.kind === "play"
              }
              onClick={() => run("preview")}
            >
              Превью
            </button>
            <button
              className="button primary small"
              disabled={
                !!busy ||
                !engineReady ||
                !health?.ffmpeg ||
                project.kind === "play"
              }
              onClick={() => run("record")}
            >
              Создать видео
            </button>
            <button
              className="button ghost small"
              disabled={!!busy}
              onClick={() =>
                perform("Очищаем реплеи…", async () => {
                  await api("/replays", "DELETE");
                  patch({ replayIds: [], mapHash: "" });
                  await refresh();
                  setPage("library");
                })
              }
            >
              Новый рендер
            </button>
          </div>
        </header>
        {notice && (
          <div role="status" className={`toast ${notice.error ? "error" : ""}`}>
            {notice.error ? <CircleHelp size={18} /> : <Check size={18} />}
            <span>{notice.text}</span>
            <button className="icon-btn" onClick={() => setNotice(null)}>
              <X size={16} />
            </button>
          </div>
        )}
        {busy && (
          <div className="busy-pill">
            <LoaderCircle className="spin" size={16} />
            {busy}
          </div>
        )}
        <div className="content">
          <main className="main">
            {page === "library" && (
              <>
                <div className="page-heading">
                  <div>
                    <div className="eyebrow">ВАШ ПУТЬ К ЛУЧШЕМУ РЕЗУЛЬТАТУ</div>
                    <h1>
                      Каждая попытка имеет значение<span>.</span>
                    </h1>
                    <p>
                      Соберите реплеи, раскрасьте свой прогресс и превратите его
                      в видео.
                    </p>
                  </div>
                </div>
                <div
                  className={`import-zone ${dragging ? "dragging" : ""}`}
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
                  <div className="upload-symbol">
                    <Upload size={22} />
                  </div>
                  <div>
                    <h3>Перетащите сюда свои реплеи</h3>
                    <p>Несколько файлов .osr · ваши попытки и реплеи друзей</p>
                  </div>
                  <button
                    className="button ghost"
                    disabled={!!busy}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Plus size={16} />
                    Выбрать файлы
                  </button>
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
                </div>
                {new Set(state.replays.map((r) => r.mapHash)).size > 1 && (
                  <p className="note warning">
                    Остались загрузки разных карт из прежней библиотеки.
                    Выберите попытки одной карты или нажмите «Новый рендер»,
                    чтобы очистить старые загрузки.
                  </p>
                )}
                <div className="library-heading">
                  <div>
                    <h2>
                      Попытки для видео <span>{state.replays.length}</span>
                    </h2>
                    <p>Дата игры берётся из реплея, а не из имени файла.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setShowFolder((v) => !v)}
                  >
                    <FolderOpen size={15} />
                    Импорт папки
                  </button>
                </div>
                {showFolder && (
                  <div className="folder-import">
                    <input
                      placeholder="D:\\osu!\\Replays"
                      value={folder}
                      onChange={(e) => setFolder(e.target.value)}
                    />
                    <button
                      className="button ghost"
                      disabled={!!busy}
                      onClick={() =>
                        perform("Импортируем папку…", async () =>
                          importResult(
                            await api("/import-folder", "POST", {
                              path: folder,
                            }),
                          ),
                        )
                      }
                    >
                      Импортировать
                    </button>
                  </div>
                )}
                <div className="filters">
                  <div className="search">
                    <Search size={17} />
                    <input
                      aria-label="Поиск реплеев"
                      placeholder="Игрок, карта или имя файла…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <select
                    aria-label="Фильтр игроков"
                    value={playerFilter}
                    onChange={(e) => setPlayerFilter(e.target.value)}
                  >
                    <option value="">Все игроки</option>
                    {players.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Сортировка"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="new">Сначала новые</option>
                    <option value="old">Сначала старые</option>
                    <option value="score">По счёту</option>
                  </select>
                </div>
                <div className="date-filters">
                  <Clock3 size={14} />
                  <span>Период</span>
                  <input
                    aria-label="Дата начала"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                  <span>—</span>
                  <input
                    aria-label="Дата конца"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                  {groups.length > 0 && (
                    <select
                      aria-label="Группа"
                      value={groupFilter}
                      onChange={(e) => setGroupFilter(e.target.value)}
                    >
                      <option value="">Все группы</option>
                      {groups.map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  )}
                  <button
                    className="text-button"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                      setMapFilter("");
                      setPlayerFilter("");
                      setSearch("");
                      setGroupFilter("");
                    }}
                  >
                    Сбросить
                  </button>
                </div>
                <div className="selection-bar">
                  <span>
                    <b>{selected.length}</b> выбрано для видео{" "}
                    {selected.length > 0 && <small>· одна карта</small>}
                  </span>
                  <div>
                    <button className="text-button" onClick={selectAll}>
                      Выбрать все попытки
                    </button>
                    <button
                      className="text-button"
                      onClick={() => patch({ replayIds: [] })}
                    >
                      Снять выбор
                    </button>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th></th>
                        <th>Игрок / попытка</th>
                        <th>Дата игры</th>
                        <th>Точность</th>
                        <th>Комбо</th>
                        <th>Промахи</th>
                        <th>Цвет</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((r) => (
                        <tr
                          key={r.id}
                          className={
                            project.replayIds.includes(r.id) ? "selected" : ""
                          }
                        >
                          <td>
                            <input
                              aria-label={`Выбрать ${r.filename}`}
                              type="checkbox"
                              checked={project.replayIds.includes(r.id)}
                              onChange={(e) =>
                                chooseReplay(r, e.target.checked)
                              }
                            />
                          </td>
                          <td>
                            <div className="player-cell">
                              <div className="avatar">
                                {r.player.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <b>{r.player}</b>
                                <small title={r.filename}>
                                  {r.modList.join(" ") || "No Mod"}{" "}
                                  <span>· {r.source}</span>
                                </small>
                              </div>
                            </div>
                            <input
                              className="group-input"
                              aria-label={`Группа ${r.filename}`}
                              defaultValue={r.group}
                              placeholder="Добавить группу"
                              onBlur={(e) => {
                                if (e.target.value !== r.group)
                                  perform("Сохраняем группу…", async () => {
                                    await api("/replays/" + r.id, "PATCH", {
                                      group: e.target.value,
                                    });
                                    await refresh();
                                  });
                              }}
                            />
                          </td>
                          <td className="date-cell">{fmtDate(r.date)}</td>
                          <td>
                            <span
                              className={
                                r.accuracy >= 98 ? "accuracy high" : "accuracy"
                              }
                            >
                              {r.accuracy.toFixed(2)}
                              <small>%</small>
                            </span>
                          </td>
                          <td>
                            {num(r.combo)}
                            <small>×</small>
                          </td>
                          <td>
                            <span className={r.misses ? "misses" : "zero"}>
                              {r.misses}
                            </span>
                          </td>
                          <td>
                            {colors[r.id] ? (
                              <input
                                className="swatch"
                                aria-label={`Цвет ${r.filename}`}
                                type="color"
                                value={colors[r.id]}
                                onChange={(e) =>
                                  updatePalette("overrides", {
                                    ...project.palette.overrides,
                                    [r.id]: e.target.value,
                                  })
                                }
                              />
                            ) : (
                              <span className="unselected-dot" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!visible.length && (
                    <div className="empty-library">
                      <Layers3 size={35} />
                      <h3>
                        {state.replays.length
                          ? "Ничего не найдено"
                          : "Здесь начинается ваша история"}
                      </h3>
                      <p>
                        {state.replays.length
                          ? "Измените фильтры, чтобы найти нужные попытки."
                          : "Добавьте реплеи одной карты за разные даты — и увидите свой прогресс."}
                      </p>
                      {!state.replays.length && (
                        <button
                          className="button primary"
                          onClick={() => fileRef.current?.click()}
                        >
                          <Plus size={16} />
                          Добавить первые реплеи
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="library-foot">
                  <span>
                    <i />
                    osu!standard · stable и lazer
                  </span>
                  <span>
                    Показано {visible.length} из {state.replays.length}
                  </span>
                </div>
                {selected.length > 0 && (
                  <section className="legend">
                    <h3>
                      История в цвете <small>Даты выбранных попыток</small>
                    </h3>
                    <div
                      className="legend-gradient"
                      style={{ background: paletteCss }}
                    />
                    <div className="legend-items">
                      {[...selected]
                        .sort(
                          (a, b) =>
                            (a.date ? Date.parse(a.date) : Infinity) -
                              (b.date ? Date.parse(b.date) : Infinity) ||
                            a.id.localeCompare(b.id),
                        )
                        .map((r) => (
                          <div key={r.id}>
                            <i style={{ background: colors[r.id] }} />
                            <span>
                              {r.player}
                              <small>{fmtDate(r.date)}</small>
                            </span>
                            <code>{colors[r.id]}</code>
                            <button
                              className="icon-btn"
                              title="Снять ручной цвет"
                              onClick={() => {
                                const overrides = {
                                  ...project.palette.overrides,
                                };
                                delete overrides[r.id];
                                updatePalette("overrides", overrides);
                              }}
                            >
                              <RefreshCw size={12} />
                            </button>
                          </div>
                        ))}
                    </div>
                  </section>
                )}
                <section className="workflow-card map-summary">
                  <h2>Карта из реплея</h2>
                  <p>
                    {map
                      ? `${map.artist} — ${map.title} [${map.difficulty}]`
                      : project.mapHash
                        ? "Точная версия карты не найдена"
                        : "Загрузите реплеи — карта определится автоматически"}
                  </p>
                  {project.mapHash && <small>MD5: {project.mapHash}</small>}
                  {project.mapHash && !map && (
                    <p className="warning">
                      Подключите Songs / lazer или импортируйте .osz с этой
                      версией карты.
                    </p>
                  )}
                  <div className="job-actions">
                    <button
                      className="text-button"
                      disabled={!!busy || !project.mapHash}
                      onClick={() =>
                        perform("Ищем карту…", async () => {
                          await api("/maps/resolve", "POST", {
                            hash: project.mapHash,
                          });
                          await refresh();
                        })
                      }
                    >
                      Повторить поиск
                    </button>
                    <button
                      className="button ghost"
                      disabled={!!busy}
                      onClick={() => mapRef.current?.click()}
                    >
                      Импорт .osz
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
                        perform("Импортируем карту…", async () => {
                          const form = new FormData();
                          form.append("file", f);
                          await api("/maps/import", "POST", form);
                          await refresh();
                          if (project.mapHash)
                            await api("/maps/resolve", "POST", {
                              hash: project.mapHash,
                            });
                        });
                      e.target.value = "";
                    }}
                  />
                </section>
                <div className="workflow-grid">
                  <PalettePanel
                    project={project}
                    selected={selected}
                    updatePalette={updatePalette}
                    paletteCss={paletteCss}
                  />
                  <RulesPanel project={project} updateRules={updateRules} />
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
                <div className="workflow-bottom">
                  <LaunchPanel
                    project={project}
                    patch={patch}
                    updateLaunch={updateLaunch}
                  />
                  <section className="workflow-card">
                    <h2>Скин</h2>
                    <FieldLabel label="Выбранный скин">
                      <select
                        value={project.launch.skinId ?? ""}
                        onChange={(e) => updateLaunch("skinId", e.target.value)}
                      >
                        <option value="">Встроенный скин danser</option>
                        {skins.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </FieldLabel>
                    <p className="note">
                      Папки и архивы .osk из директории Skins в подключении.
                      Можно импортировать отдельный архив.
                    </p>
                    <div className="job-actions">
                      <button
                        className="button ghost"
                        disabled={!!busy}
                        onClick={() => skinRef.current?.click()}
                      >
                        Импорт .osk
                      </button>
                      <button
                        className="text-button"
                        disabled={!!busy}
                        onClick={() => perform("Читаем скины…", loadSkins)}
                      >
                        Обновить список
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
                          perform("Импортируем скин…", async () => {
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
                </div>
                <details className="workflow-card advanced">
                  <summary>Все настройки движка</summary>
                  <div className="settings-layout">
                    <div className="settings-nav">
                      {schema
                        .filter((s) => s.key !== "Credentials")
                        .map((s) => (
                          <button
                            key={s.key}
                            className={section === s.key ? "active" : ""}
                            onClick={() => setSection(s.key)}
                          >
                            {labels[s.key] || s.key}
                          </button>
                        ))}
                    </div>
                    <div className="settings-panel">
                      <div className="settings-title">
                        <h2>{labels[section] || section}</h2>
                        <button
                          className="text-button"
                          onClick={() => {
                            setJsonMode((v) => !v);
                            setJsonText(
                              JSON.stringify(project.configPatch, null, 2),
                            );
                          }}
                        >
                          <SlidersHorizontal size={14} />
                          {jsonMode ? "Поля настроек" : "JSON"}
                        </button>
                      </div>
                      <div className="search full">
                        <Search size={16} />
                        <input
                          placeholder="Поиск по названию или JSON-пути…"
                          value={settingsSearch}
                          onChange={(e) => setSettingsSearch(e.target.value)}
                        />
                      </div>
                      <div className="note">
                        Пустое поле использует значение движка.{" "}
                        {[
                          "General",
                          "Recording",
                          "Knockout",
                          "Graphics",
                          "Cursor",
                        ].includes(section) &&
                          "Пути, экспорт, выбывание и закреплённая палитра уточняются основными параметрами перед рендером."}
                      </div>
                      <button
                        className="text-button"
                        onClick={() => configRef.current?.click()}
                      >
                        <Upload size={14} />
                        Импортировать профиль настроек
                      </button>
                      <input
                        hidden
                        ref={configRef}
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f)
                            perform("Импортируем настройки…", async () => {
                              const data = JSON.parse(await f.text());
                              if (
                                !data ||
                                typeof data !== "object" ||
                                Array.isArray(data)
                              )
                                throw new Error("Ожидается JSON-объект");
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
                                  throw new Error("Ожидается JSON-объект");
                                if (data.Credentials)
                                  throw new Error(
                                    "Авторизацию настраивайте в подключении",
                                  );
                                patch({ configPatch: data });
                                setNotice({
                                  text: "Настройки применены к рендеру",
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
                            Применить JSON
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
                <div className="workflow-card render-footer">
                  <FieldLabel label="Название видео">
                    <input
                      value={project.name}
                      onChange={(e) => patch({ name: e.target.value })}
                    />
                  </FieldLabel>
                  <div className="render-summary">
                    <span>{selected.length} попыток</span>
                    <span>
                      {project.export.width} × {project.export.height} ·{" "}
                      {project.export.fps} fps
                    </span>
                  </div>
                  {!engineReady && (
                    <p className="warning small-text">
                      {!health?.engine
                        ? "Настройте путь к danser."
                        : !map
                          ? "Загрузите реплеи и найдите точную карту."
                          : "Для цветов нужна сборка danser-studio."}
                    </p>
                  )}
                  <button
                    className="button ghost full"
                    disabled={
                      !!busy ||
                      !engineReady ||
                      !health?.ffmpeg ||
                      project.kind === "play"
                    }
                    onClick={() => run("preview")}
                  >
                    <Play size={15} />
                    Предпросмотр · 10 секунд
                  </button>
                  <button
                    className="button primary full"
                    disabled={
                      !!busy ||
                      !engineReady ||
                      !health?.ffmpeg ||
                      project.kind === "play"
                    }
                    onClick={() => run("record")}
                  >
                    <Clapperboard size={17} />
                    Создать видео
                  </button>
                </div>
              </>
            )}
            {page === "queue" && (
              <>
                <div className="page-heading">
                  <div className="eyebrow">ОТ ПОПЫТОК К ВИДЕО</div>
                  <h1>
                    Рендеринг<span>.</span>
                  </h1>
                  <p>
                    Задания выполняются по очереди. Настройки сохраняются в
                    текущей сессии.
                  </p>
                </div>
                <div className="jobs">
                  {state.jobs.map((j) => (
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
                                  queued: "В очереди",
                                  running: "Рендеринг",
                                  completed: "Готово",
                                  failed: "Ошибка",
                                  cancelled: "Отменено",
                                  interrupted: "Прервано",
                                } as Record<string, string>
                              )[j.status]
                            }
                          </span>
                        </div>
                        <p>
                          {
                            (
                              {
                                record: "Видео",
                                preview: "Предпросмотр 10 секунд",
                                screenshot: "Снимок",
                                watch: "Окно просмотра",
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
                            Журнал
                          </button>
                          {["queued", "running"].includes(j.status) ? (
                            <button
                              className="text-button danger"
                              onClick={() =>
                                perform("Отменяем…", async () => {
                                  await api(
                                    "/jobs/" + j.id + "/cancel",
                                    "POST",
                                  );
                                  await refresh();
                                })
                              }
                            >
                              Отменить
                            </button>
                          ) : (
                            <button
                              className="text-button"
                              onClick={() =>
                                perform("Запускаем повторно…", async () => {
                                  await api("/jobs/" + j.id + "/retry", "POST");
                                  await refresh();
                                })
                              }
                            >
                              Повторить
                            </button>
                          )}
                          {j.status === "completed" && j.action !== "watch" && (
                            <>
                              <button
                                className="text-button"
                                onClick={() => setSelectedJob(j)}
                              >
                                <Play size={14} />
                                Посмотреть
                              </button>
                              <a
                                className="text-button"
                                href={`/api/jobs/${j.id}/output?download=1`}
                              >
                                <ArrowDownToLine size={14} />
                                Сохранить файл
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
                    <h3>Пока без заданий</h3>
                    <p>Выберите реплеи и нажмите «Создать видео».</p>
                    <button
                      className="button ghost"
                      onClick={() => setPage("library")}
                    >
                      Создать видео
                    </button>
                  </div>
                )}
              </>
            )}
            {page === "settings" && (
              <>
                <div className="page-heading">
                  <h1>
                    Подключение<span>.</span>
                  </h1>
                  <p>Локальные пути сохраняются между сессиями.</p>
                </div>
                <div className="settings-panel">
                  <LazerConnection
                    value={cfg.lazerDir ?? ""}
                    onChange={(v) => setCfg((c) => ({ ...c, lazerDir: v }))}
                    busy={!!busy}
                    onDetect={() =>
                      perform("Ищем хранилище lazer…", async () => {
                        const found = await api("/lazer/detect");
                        if (!found.path)
                          throw new Error(
                            "Стандартная папка lazer не найдена. Укажите её вручную.",
                          );
                        setCfg((c) => ({ ...c, lazerDir: found.path }));
                      })
                    }
                    onConnect={() =>
                      perform("Читаем индекс lazer…", async () => {
                        await api("/config", "PUT", cfg);
                        const result = await api("/maps/scan", "POST");
                        await refresh();
                        setHealth(await api("/health"));
                        setNotice({
                          text: `Индекс обновлён: ${result.maps.length} карт. Ошибок: ${result.errors.length}`,
                          error: !!result.errors.length,
                        });
                      })
                    }
                  />
                  <h2>Окружение</h2>
                  <div className="health-grid">
                    {[
                      ["engine", "Danser"],
                      ["studio", "Цвета реплеев"],
                      ["ffmpeg", "FFmpeg"],
                      ["songs", "Songs"],
                      ["lazer", "osu!lazer"],
                    ].map(([key, label]) => (
                      <div key={key}>
                        <i className={health?.[key] ? "green" : ""} />
                        <span>{label}</span>
                        <small>
                          {health?.[key] ? "Готово" : "Не настроено"}
                        </small>
                      </div>
                    ))}
                  </div>
                  {[
                    [
                      "enginePath",
                      "Исполняемый файл danser",
                      "D:\\…\\danser-studio.exe",
                    ],
                    ["songsDir", "Папка Songs", "D:\\osu!\\Songs"],
                    ["skinsDir", "Папка Skins", "D:\\osu!\\Skins"],
                    ["replaysDir", "Папка реплеев osu!", "D:\\osu!\\Replays"],
                    ["outputDir", "Готовые видео", "D:\\Videos"],
                    [
                      "ffmpegPath",
                      "FFmpeg",
                      "ffmpeg или полный путь к ffmpeg.exe",
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
                  <p className="note">
                    Для закреплённых цветов используйте сборку danser-studio из
                    этого проекта. Оригинальный danser поддерживает остальные
                    сценарии. Папка реплеев приложения хранится отдельно от
                    внутренней папки danser.
                  </p>
                  <button
                    className="button primary"
                    disabled={!!busy}
                    onClick={() =>
                      perform("Проверяем окружение…", async () => {
                        await api("/config", "PUT", cfg);
                        await refresh();
                        await loadSkins();
                        setHealth(await api("/health"));
                        setNotice({
                          text: "Пути сохранены, проверка завершена",
                          error: false,
                        });
                      })
                    }
                  >
                    <Check size={16} />
                    Сохранить и проверить
                  </button>
                  <CredentialsPanel />
                </div>
              </>
            )}
          </main>
        </div>
      </div>
      {selectedJob && (
        <div className="modal-backdrop" onClick={() => setSelectedJob(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-title">
              <h2>{selectedJob.name}</h2>
              <button className="icon-btn" onClick={() => setSelectedJob(null)}>
                <X size={20} />
              </button>
            </div>
            {selectedJob.status === "completed" &&
              selectedJob.action !== "watch" &&
              (selectedJob.action === "screenshot" ? (
                <img
                  className="output-image"
                  src={`/api/jobs/${selectedJob.id}/output`}
                />
              ) : (
                <video controls src={`/api/jobs/${selectedJob.id}/output`} />
              ))}
            <h3>Журнал задания</h3>
            <pre>
              {state.jobs.find((j) => j.id === selectedJob.id)?.log ||
                "Задание ещё не запущено"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
