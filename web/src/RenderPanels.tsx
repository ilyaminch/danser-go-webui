import {
  Activity,
  ArrowLeftRight,
  Clapperboard,
  Palette as PaletteIcon,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { FieldLabel, Toggle } from "./controls";
import type { Project, Replay } from "./render-types";
type Update = (key: string, value: any) => void;
const modes = [
  "Combo Break",
  "Max Combo",
  "Replay Showcase",
  "Vs Mode",
  "SS or Quit",
];
const modeHints = [
  "Курсор выбывает при промахе или срыве слайдера.",
  "Выбывание при срыве около максимального комбо попытки.",
  "Все попытки остаются видимыми до конца.",
  "Все игроки остаются; оценки ниже 300 видны на поле.",
  "Выбывание при 100, 50, промахе или срыве комбо.",
];

export function PalettePanel({
  project,
  selected,
  updatePalette,
  paletteCss,
}: {
  project: Project;
  selected: Replay[];
  updatePalette: Update;
  paletteCss: string;
}) {
  return (
    <section className="workflow-card">
      {project.kind !== "comparison" && (
        <p className="note">
          Закреплённые цвета применяются в сценарии «Сравнение реплеев».
        </p>
      )}
      <div className="section-title">
        <PaletteIcon size={16} />
        <h3>Палитра курсоров</h3>
        <span>ПО ДАТЕ</span>
      </div>
      <FieldLabel label="Как назначать цвета">
        <select
          value={project.palette.mode}
          onChange={(e) => updatePalette("mode", e.target.value)}
        >
          <option value="date">Общий градиент по датам</option>
          <option value="per-player">Градиент внутри каждого игрока</option>
          <option value="player">Цвет каждого игрока</option>
        </select>
      </FieldLabel>
      {project.palette.mode !== "player" ? (
        <>
          <div className="palette-preview" style={{ background: paletteCss }} />
          <div className="gradient-labels">
            <span>Старые попытки</span>
            <span>Новые попытки</span>
          </div>
          <div className="color-stops">
            {project.palette.stops.map((c, i) => (
              <div key={i}>
                <input
                  aria-label={`Цвет градиента ${i + 1}`}
                  type="color"
                  value={c}
                  onChange={(e) =>
                    updatePalette(
                      "stops",
                      project.palette.stops.map((s, j) =>
                        i === j ? e.target.value : s,
                      ),
                    )
                  }
                />
                <code>{c}</code>
                {project.palette.stops.length > 2 && (
                  <button
                    className="icon-btn"
                    title="Убрать точку"
                    onClick={() =>
                      updatePalette(
                        "stops",
                        project.palette.stops.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="palette-actions">
            <button
              className="text-button"
              onClick={() =>
                updatePalette("stops", [
                  ...project.palette.stops.slice(0, -1),
                  "#b9a7fa",
                  project.palette.stops.at(-1)!,
                ])
              }
            >
              <Plus size={13} />
              Точка
            </button>
            <button
              className="text-button"
              onClick={() => updatePalette("reverse", !project.palette.reverse)}
            >
              <ArrowLeftRight size={13} />
              Развернуть
            </button>
          </div>
          <div className="preset-swatches">
            {[
              ["#f06b78", "#f5cf76", "#a4e878"],
              ["#8597fd", "#b4a0fa", "#f3b0ce"],
              ["#42bacc", "#a4e878"],
              ["#ed8556", "#b59cf9"],
            ].map((stops, i) => (
              <button
                key={i}
                aria-label={`Пресет градиента ${i + 1}`}
                style={{
                  background: `linear-gradient(90deg,${stops.join(",")})`,
                }}
                onClick={() => updatePalette("stops", stops)}
              />
            ))}
          </div>
          <FieldLabel label="Распределение">
            <select
              value={project.palette.spacing}
              onChange={(e) => updatePalette("spacing", e.target.value)}
            >
              <option value="rank">Равномерно между датами</option>
              <option value="time">По реальным интервалам времени</option>
            </select>
          </FieldLabel>
        </>
      ) : (
        <div className="player-colors">
          {[...new Set(selected.map((r) => r.player))].map((p) => (
            <label key={p}>
              {p}
              <input
                aria-label={`Цвет игрока ${p}`}
                type="color"
                value={project.palette.players[p] ?? "#8b9cf7"}
                onChange={(e) =>
                  updatePalette("players", {
                    ...project.palette.players,
                    [p]: e.target.value,
                  })
                }
              />
            </label>
          ))}
          {!selected.length && <p className="note">Добавьте реплеи игроков.</p>}
        </div>
      )}
      <div className="tip">
        <Sparkles size={16} />
        <p>
          Цвет закреплён за попыткой и сохраняется после выбывания. Любой курсор
          можно перекрасить вручную в таблице.
        </p>
      </div>
      <button
        className="text-button"
        onClick={() => updatePalette("overrides", {})}
      >
        Сбросить ручные цвета
      </button>
    </section>
  );
}

export function RulesPanel({
  project,
  updateRules,
}: {
  project: Project;
  updateRules: Update;
}) {
  return (
    <section className="workflow-card">
      <div className="section-title">
        <Activity size={16} />
        <h3>Правила сравнения</h3>
      </div>
      <FieldLabel label="Режим движка">
        <select
          value={project.rules.mode}
          onChange={(e) => updateRules("mode", Number(e.target.value))}
        >
          {modes.map((m, i) => (
            <option key={m} value={i}>
              {m}
            </option>
          ))}
        </select>
      </FieldLabel>
      <p className="note">{modeHints[project.rules.mode]}</p>
      {[0, 1, 4].includes(project.rules.mode) && (
        <>
          <FieldLabel
            label="Минимум оставшихся игроков"
            hint="0 — могут выбыть все. 1 — последний игрок остаётся."
          >
            <input
              type="number"
              min="0"
              max="100"
              value={project.rules.minPlayers}
              onChange={(e) =>
                updateRules("minPlayers", Number(e.target.value))
              }
            />
          </FieldLabel>
          {project.rules.mode === 0 && (
            <FieldLabel
              label="Иммунитет до момента, с"
              hint="−10 — без начального иммунитета."
            >
              <input
                type="number"
                step="any"
                value={project.rules.grace}
                onChange={(e) => updateRules("grace", Number(e.target.value))}
              />
            </FieldLabel>
          )}
          <Toggle
            label="Вернуть выбывших в конце"
            value={project.rules.revive}
            onChange={(v) => updateRules("revive", v)}
          />
        </>
      )}
      <Toggle
        label="Добавить курсор danser"
        value={project.rules.addDanser}
        onChange={(v) => updateRules("addDanser", v)}
      />
      <Toggle
        label="Сортировать таблицу в реальном времени"
        value={project.rules.liveSort}
        onChange={(v) => updateRules("liveSort", v)}
      />
      <FieldLabel label="Рейтинг игроков">
        <select
          value={project.rules.sortBy}
          onChange={(e) => updateRules("sortBy", e.target.value)}
        >
          <option value="Score">По счёту</option>
          <option value="PP">По PP</option>
          <option value="Accuracy">По точности</option>
        </select>
      </FieldLabel>
      <div className="tip">
        <Activity size={16} />
        <p>
          Для прогресса тренировок: Combo Break, минимум 0, без возвращения в
          конце. Старые попытки выбывают, новые продолжают карту.
        </p>
      </div>
    </section>
  );
}

export function ExportPanel({
  project,
  patch,
  updateExport,
  updateLaunch,
  busy,
  engineReady,
  run,
}: {
  project: Project;
  patch: (changes: Partial<Project>) => void;
  updateExport: Update;
  updateLaunch: Update;
  busy: string;
  engineReady: boolean;
  run: (action: string) => void;
}) {
  return (
    <section className="workflow-card">
      <div className="section-title">
        <Clapperboard size={16} />
        <h3>Готовое видео</h3>
      </div>
      <FieldLabel label="Пресет">
        <select
          value={`${project.export.width}x${project.export.height}x${project.export.fps}`}
          onChange={(e) => {
            const [width, height, fps] = e.target.value.split("x").map(Number);
            patch({ export: { ...project.export, width, height, fps } });
          }}
        >
          <option value="1920x1080x60">Full HD · 1080p / 60 fps</option>
          <option value="2560x1440x60">QHD · 1440p / 60 fps</option>
          <option value="3840x2160x60">4K · 2160p / 60 fps</option>
          <option value="1280x720x30">Быстро · 720p / 30 fps</option>
          <option
            value={`${project.export.width}x${project.export.height}x${project.export.fps}`}
          >
            Текущие значения
          </option>
        </select>
      </FieldLabel>
      <div className="form-grid">
        {[
          ["width", "Ширина"],
          ["height", "Высота"],
          ["fps", "FPS"],
        ].map(([key, label]) => (
          <FieldLabel key={key} label={label}>
            <input
              type="number"
              value={(project.export as any)[key]}
              onChange={(e) => updateExport(key, Number(e.target.value))}
            />
          </FieldLabel>
        ))}
      </div>
      <FieldLabel label="Видеокодек">
        <select
          value={project.export.encoder}
          onChange={(e) => updateExport("encoder", e.target.value)}
        >
          {[
            "libx264",
            "libx265",
            "libsvtav1",
            "h264_nvenc",
            "hevc_nvenc",
            "av1_nvenc",
            "h264_qsv",
            "hevc_qsv",
            "h264_amf",
            "hevc_amf",
            "av1_amf",
          ].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </FieldLabel>
      <FieldLabel label="Контейнер">
        <select
          value={project.export.container}
          onChange={(e) => updateExport("container", e.target.value)}
        >
          <option value="mp4">MP4</option>
          <option value="mkv">MKV</option>
        </select>
      </FieldLabel>
      <div className="form-grid">
        <FieldLabel label="Начало, с">
          <input
            type="number"
            min="0"
            step="any"
            value={project.launch.start}
            onChange={(e) => updateLaunch("start", Number(e.target.value))}
          />
        </FieldLabel>
        <FieldLabel label="Конец, с">
          <input
            type="number"
            step="any"
            placeholder="Вся карта"
            value={project.launch.end ?? ""}
            onChange={(e) =>
              updateLaunch(
                "end",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
          />
        </FieldLabel>
      </div>
      <p className="note">
        Аппаратный кодек должен поддерживаться вашим FFmpeg и видеокартой. Для
        браузера подходит MP4 / H.264 / AAC.
      </p>
      <button
        className="button ghost full"
        disabled={!!busy || !engineReady}
        onClick={() => run("screenshot")}
      >
        Снимок выбранного момента
      </button>
      <button
        className="button ghost full"
        disabled={!!busy || !engineReady}
        onClick={() => run("watch")}
      >
        Просмотр в окне danser
      </button>
    </section>
  );
}

export function LaunchPanel({
  project,
  patch,
  updateLaunch,
}: {
  project: Project;
  patch: (changes: Partial<Project>) => void;
  updateLaunch: Update;
}) {
  return (
    <section className="workflow-card">
      <h2>Параметры запуска</h2>
      <FieldLabel label="Сценарий">
        <select
          value={project.kind}
          onChange={(e) => patch({ kind: e.target.value })}
        >
          <option value="comparison">Сравнение реплеев</option>
          <option value="replay">Один реплей</option>
          <option value="dance">Cursor Dance</option>
          <option value="autoplay">Autoplay с replay UI</option>
          <option value="classic">Классический knockout</option>
          <option value="play">Интерактивная игра в окне danser</option>
        </select>
      </FieldLabel>
      <div className="form-grid">
        {[
          ["speed", "Скорость"],
          ["pitch", "Pitch"],
          ["offset", "Локальный offset, мс"],
          ["cursors", "Mirror: курсоры"],
          ["tag", "TAG: курсоры"],
          ["screenshotTime", "Момент снимка, с"],
          ["cs", "CS"],
          ["ar", "AR"],
          ["od", "OD"],
          ["hp", "HP"],
        ].map(([key, label]) => (
          <FieldLabel label={label} key={key}>
            <input
              type="number"
              step="any"
              value={project.launch[key] ?? ""}
              placeholder="По умолчанию"
              onChange={(e) =>
                updateLaunch(
                  key,
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </FieldLabel>
        ))}
      </div>
      <FieldLabel
        label="Моды classic"
        hint="Переопределяет моды одиночного реплея. Например HDHR."
      >
        <input
          value={project.launch.mods ?? ""}
          onChange={(e) => updateLaunch("mods", e.target.value)}
        />
      </FieldLabel>
      <FieldLabel
        label="Моды lazer (mods2)"
        hint="JSON-массив с acronym и settings; не совмещается с classic mods."
      >
        <textarea
          value={project.launch.mods2 ?? ""}
          placeholder='[{"acronym":"DT","settings":{"speed_change":1.2}}]'
          onChange={(e) => updateLaunch("mods2", e.target.value)}
        />
      </FieldLabel>
      {[
        ["skip", "Пропустить вступление"],
        ["quickstart", "Быстрый старт без lead-in"],
        ["noDbCheck", "Пропустить полную проверку базы"],
        ["noUpdateCheck", "Не проверять обновления danser"],
        ["debug", "Отладочная информация"],
        ["gldebug", "Журнал OpenGL"],
      ].map(([key, label]) => (
        <Toggle
          key={key}
          label={label}
          value={!!project.launch[key]}
          onChange={(v) => updateLaunch(key, v)}
        />
      ))}
      <p className="note">
        CS/AR/OD/HP зависят от сценария и DA. Сравнение сохраняет исходные моды
        попыток. Для Play доступен просмотр в нативном окне.
      </p>
    </section>
  );
}
