import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { MapInfo } from "./render-types";
import { t } from "./i18n";

export function MapPicker({
  maps,
  value,
  onChange,
}: {
  maps: MapInfo[];
  value: string;
  onChange: (hash: string) => void;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({
    left: 32,
    top: 200,
    width: 450,
    maxHeight: 400,
  });
  const selected = maps.find((m) => m.hash === value);
  const filtered = maps.filter((m) =>
    `${m.artist} ${m.title} ${m.difficulty} ${m.creator}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const results = filtered.slice(0, 100);
  useEffect(() => {
    if (open) search.current?.focus();
    const close = () => panel.current?.hidePopover();
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, [open]);
  useEffect(() => {
    panel.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, query]);
  const choose = (hash: string) => {
    onChange(hash);
    panel.current?.hidePopover();
  };
  return (
    <div className="map-picker">
      <span className="field-label">{t("Карта и сложность")}</span>
      <button
        type="button"
        className="map-picker-trigger"
        popoverTarget={id}
        aria-label={t("Выбрать карту")}
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const below = window.innerHeight - r.bottom - 16;
          const height = Math.min(420, Math.max(below, r.top - 16));
          setPosition({
            left: Math.max(
              8,
              Math.min(
                r.left,
                window.innerWidth - Math.min(520, window.innerWidth - 16) - 8,
              ),
            ),
            top: below >= 260 ? r.bottom + 8 : Math.max(8, r.top - height - 8),
            width: Math.min(520, window.innerWidth - 16),
            maxHeight: height,
          });
          setQuery("");
          setActive(0);
        }}
      >
        <span>
          {selected
            ? `${selected.artist} — ${selected.title} [${selected.difficulty}]`
            : t("Выберите карту")}
        </span>
        <ChevronDown size={17} />
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        className="map-picker-panel"
        style={position}
        onToggle={(e) => setOpen(e.newState === "open")}
      >
        <div className="map-picker-search">
          <Search size={17} aria-hidden="true" />
          <input
            ref={search}
            role="combobox"
            aria-label={t("Поиск карт")}
            aria-expanded={open}
            aria-controls={`${id}-results`}
            aria-autocomplete="list"
            aria-activedescendant={
              results[active] ? `${id}-option-${active}` : undefined
            }
            placeholder={t("Название, исполнитель или сложность")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) =>
                  Math.max(
                    0,
                    Math.min(
                      results.length - 1,
                      a + (e.key === "ArrowDown" ? 1 : -1),
                    ),
                  ),
                );
              } else if (e.key === "Enter" && results[active]) {
                e.preventDefault();
                choose(results[active].hash);
              }
            }}
          />
        </div>
        <div
          id={`${id}-results`}
          role="listbox"
          aria-label={t("Карты")}
          className="map-picker-results"
        >
          {results.map((m, i) => (
            <button
              type="button"
              role="option"
              aria-selected={m.hash === value}
              id={`${id}-option-${i}`}
              data-index={i}
              key={m.hash}
              tabIndex={-1}
              className={i === active ? "active" : ""}
              onPointerMove={() => setActive(i)}
              onClick={() => choose(m.hash)}
            >
              <span>
                <b>{m.title}</b>
                <small>
                  {m.artist} · {m.creator}
                </small>
                <span className="map-difficulty">{m.difficulty}</span>
              </span>
              {m.hash === value && <Check size={18} aria-hidden="true" />}
            </button>
          ))}
        </div>
        <p className="map-picker-count" role="status">
          {!filtered.length
            ? t("Карты не найдены")
            : filtered.length > 100
              ? t("Показаны первые 100 карт. Уточните поиск.")
              : t("Найдено карт: {count}", { count: filtered.length })}
        </p>
      </div>
    </div>
  );
}
