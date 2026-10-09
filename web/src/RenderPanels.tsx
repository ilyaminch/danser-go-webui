import { t } from "./i18n";
import {
  Activity,
  ArrowLeftRight,
  Clapperboard,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { FieldLabel, Toggle } from "./controls";
import type { Project } from "./render-types";
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

export function DateGradientPanel({
  project,
  updatePalette,
  paletteCss,
}: {
  project: Project;
  updatePalette: Update;
  paletteCss: string;
}) {
  return (
    <section className="workflow-card">
      <div className="palette-preview" style={{ background: paletteCss }} />
      <div className="gradient-labels">
        <span>{t("Старые попытки")}</span>
        <span>{t("Новые попытки")}</span>
      </div>
      <div className="color-stops">
        {project.palette.stops.map((c, i) => (
          <div key={i}>
            <input
              aria-label={t("Цвет градиента {n}", { n: i + 1 })}
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
                title={t("Убрать точку")}
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
          {t("Точка")}
        </button>
        <button
          className="text-button"
          onClick={() => updatePalette("reverse", !project.palette.reverse)}
        >
          <ArrowLeftRight size={13} />
          {t("Развернуть")}
        </button>
      </div>
      <div className="preset-swatches">
        {[
          ["#ff66aa", "#9565f5", "#35ced3"],
          ["#5798ff", "#9565f5", "#ff66aa"],
          ["#42bacc", "#a4e878"],
          ["#ed8556", "#b59cf9"],
        ].map((stops, i) => (
          <button
            key={i}
            aria-label={t("Пресет градиента {n}", { n: i + 1 })}
            style={{
              background: `linear-gradient(90deg,${stops.join(",")})`,
            }}
            onClick={() => updatePalette("stops", stops)}
          />
        ))}
      </div>
      <FieldLabel label={t("Распределение")}>
        <select
          value={project.palette.spacing}
          onChange={(e) => updatePalette("spacing", e.target.value)}
        >
          <option value="rank">{t("Равномерно между датами")}</option>
          <option value="time">{t("По реальным интервалам времени")}</option>
        </select>
      </FieldLabel>
      <p className="note">
        {t("Ручной цвет попытки имеет приоритет над градиентом.")}
      </p>
      <button
        className="text-button"
        onClick={() => updatePalette("overrides", {})}
      >
        {t("Сбросить ручные цвета")}
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
        <h3>{t("Правила сравнения")}</h3>
      </div>
      <FieldLabel label={t("Режим движка")}>
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
      <p className="note">{t(modeHints[project.rules.mode])}</p>
      {[0, 1, 4].includes(project.rules.mode) && (
        <>
          <FieldLabel
            label={t("Минимум оставшихся игроков")}
            hint={t("0 — могут выбыть все. 1 — последний игрок остаётся.")}
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
              label={t("Иммунитет до момента, с")}
              hint={t("−10 — без начального иммунитета.")}
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
            label={t("Вернуть выбывших в конце")}
            value={project.rules.revive}
            onChange={(v) => updateRules("revive", v)}
          />
        </>
      )}
      <Toggle
        label={t("Добавить курсор danser")}
        value={project.rules.addDanser}
        onChange={(v) => updateRules("addDanser", v)}
      />
      <Toggle
        label={t("Сортировать таблицу в реальном времени")}
        value={project.rules.liveSort}
        onChange={(v) => updateRules("liveSort", v)}
      />
      <FieldLabel label={t("Рейтинг игроков")}>
        <select
          value={project.rules.sortBy}
          onChange={(e) => updateRules("sortBy", e.target.value)}
        >
          <option value="Score">{t("По счёту")}</option>
          <option value="PP">{t("По PP")}</option>
          <option value="Accuracy">{t("По точности")}</option>
        </select>
      </FieldLabel>
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
        <h3>{t("Готовое видео")}</h3>
      </div>
      <FieldLabel label={t("Пресет")}>
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
          <option value="1280x720x30">{t("Быстро · 720p / 30 fps")}</option>
          <option
            value={`${project.export.width}x${project.export.height}x${project.export.fps}`}
          >
            {t("Текущие значения")}
          </option>
        </select>
      </FieldLabel>
      <div className="form-grid">
        {[
          ["width", t("Ширина")],
          ["height", t("Высота")],
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
      <FieldLabel label={t("Видеокодек")}>
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
      <FieldLabel label={t("Контейнер")}>
        <select
          value={project.export.container}
          onChange={(e) => updateExport("container", e.target.value)}
        >
          <option value="mp4">MP4</option>
          <option value="mkv">MKV</option>
        </select>
      </FieldLabel>
      {project.export.encoder === "h264_nvenc" && (
        <div className="form-grid">
          <FieldLabel
            label={t("Пресет NVENC")}
            hint={t("p1 — быстрее, p7 — лучше сжатие.")}
          >
            <select
              value={project.configPatch.Recording?.h264_nvenc?.Preset ?? "p4"}
              onChange={(e) =>
                patch({
                  configPatch: {
                    ...project.configPatch,
                    Recording: {
                      ...project.configPatch.Recording,
                      h264_nvenc: {
                        ...project.configPatch.Recording?.h264_nvenc,
                        Preset: e.target.value,
                      },
                    },
                  },
                })
              }
            >
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option
                  key={n}
                  value={`p${n}`}
                >{`p${n}${n === 4 ? t(" — баланс") : n === 1 ? t(" — самый быстрый") : ""}`}</option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel
            label={t("Качество NVENC (CQ)")}
            hint={t("Меньшее число — выше качество и больше файл.")}
          >
            <input
              type="number"
              min="0"
              max="51"
              value={project.configPatch.Recording?.h264_nvenc?.CQ ?? 22}
              onChange={(e) =>
                patch({
                  configPatch: {
                    ...project.configPatch,
                    Recording: {
                      ...project.configPatch.Recording,
                      h264_nvenc: {
                        ...project.configPatch.Recording?.h264_nvenc,
                        RateControl: "cq",
                        CQ: Number(e.target.value),
                      },
                    },
                  },
                })
              }
            />
          </FieldLabel>
        </div>
      )}
      <div className="form-grid">
        <FieldLabel label={t("Начало, с")}>
          <input
            type="number"
            min="0"
            step="any"
            value={project.launch.start}
            onChange={(e) => updateLaunch("start", Number(e.target.value))}
          />
        </FieldLabel>
        <FieldLabel label={t("Конец, с")}>
          <input
            type="number"
            step="any"
            placeholder={t("Вся карта")}
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
        {t(
          "Аппаратный кодек должен поддерживаться вашим FFmpeg и видеокартой. Для браузера подходит MP4 / H.264 / AAC.",
        )}
      </p>
      <button
        className="button ghost full"
        disabled={!!busy || !engineReady}
        onClick={() => run("screenshot")}
      >
        {t("Снимок выбранного момента")}
      </button>
    </section>
  );
}

export function LaunchPanel({
  project,
  updateLaunch,
}: {
  project: Project;
  updateLaunch: Update;
}) {
  return (
    <section className="workflow-card">
      <h2>{t("Параметры запуска")}</h2>
      <div className="form-grid">
        {[
          ["speed", t("Скорость")],
          ["pitch", "Pitch"],
          ["offset", t("Локальный offset, мс")],
          ["cursors", t("Mirror: курсоры")],
          ["tag", t("TAG: курсоры")],
          ["screenshotTime", t("Момент снимка, с")],
          ["cs", t("CS — размер кругов"), t("Выше значение — меньше круги.")],
          [
            "ar",
            t("AR — скорость появления"),
            t("Выше значение — меньше времени на чтение объектов."),
          ],
          [
            "od",
            t("OD — точность попаданий"),
            t("Выше значение — строже оценка попадания по времени."),
          ],
          [
            "hp",
            t("HP — сложность удержания здоровья"),
            t("Выше значение — требовательнее шкала здоровья."),
          ],
        ]
          .filter(
            ([key]) =>
              !["cursors", "tag", "cs", "ar", "od", "hp"].includes(key) ||
              ["dance", "autoplay"].includes(project.kind),
          )
          .map(([key, label, hint]) => (
            <FieldLabel label={label} key={key} hint={hint}>
              <input
                type="number"
                step="any"
                value={project.launch[key] ?? ""}
                placeholder={t("По умолчанию")}
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
      {project.kind !== "comparison" && (
        <>
          <FieldLabel
            label={t("Моды classic")}
            hint={t("Моды визуализации карты. Например HDHR.")}
          >
            <input
              value={project.launch.mods ?? ""}
              onChange={(e) => updateLaunch("mods", e.target.value)}
            />
          </FieldLabel>
          <FieldLabel
            label={t("Моды lazer (mods2)")}
            hint={t(
              "JSON-массив с acronym и settings; не совмещается с classic mods.",
            )}
          >
            <textarea
              value={project.launch.mods2 ?? ""}
              placeholder='[{"acronym":"DT","settings":{"speed_change":1.2}}]'
              onChange={(e) => updateLaunch("mods2", e.target.value)}
            />
          </FieldLabel>
        </>
      )}
      {[
        ["skip", t("Пропустить вступление")],
        ["quickstart", t("Быстрый старт без lead-in")],
        ["noDbCheck", t("Пропустить полную проверку базы")],
        ["noUpdateCheck", t("Не проверять обновления danser")],
        ["debug", t("Отладочная информация")],
        ["gldebug", t("Журнал OpenGL")],
      ].map(([key, label]) => (
        <Toggle
          key={key}
          label={label}
          value={!!project.launch[key]}
          onChange={(v) => updateLaunch(key, v)}
        />
      ))}
      <p className="note">
        {project.kind === "comparison"
          ? t(
              "Сложность берётся из карты и исходных модов каждой попытки, включая Difficulty Adjust.",
            )
          : t(
              "CS/AR/OD/HP изменяют сложность визуализации карты. Пустое поле сохраняет значение карты с выбранными модами. Mirror и TAG управляют автоматическими курсорами.",
            )}
      </p>
    </section>
  );
}
