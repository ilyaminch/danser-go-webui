import { useEffect, useRef, useState } from "react";
import { Disc3, Pause, Play, Volume2, VolumeX } from "lucide-react";
import type { MapInfo } from "./render-types";
import { t } from "./i18n";
import { previewStart } from "../shared/music.mjs";

export function VinylStage({ map }: { map?: MapInfo }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [media, setMedia] = useState<{
    background: string | null;
    audio: string | null;
    previewTime: number;
  }>({ background: null, audio: null, previewTime: -1 });
  const [playing, setPlaying] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() =>
    Number(sessionStorage.getItem("studio-music-volume") ?? 0.25),
  );
  const [muted, setMuted] = useState(
    () => sessionStorage.getItem("studio-music-muted") === "true",
  );
  const [motion, setMotion] = useState(
    () => sessionStorage.getItem("studio-motion") !== "false",
  );
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setMedia({ background: null, audio: null, previewTime: -1 });
    setPlaying(false);
    setElapsed(0);
    setDuration(0);
    setError("");
    if (map)
      fetch(`/api/maps/${map.hash}/media`, { signal: controller.signal })
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then(setMedia)
        .catch((e) => {
          if (e.name !== "AbortError")
            setError(t("Не удалось прочитать ресурсы карты"));
        });
    return () => controller.abort();
  }, [map?.hash]);
  useEffect(() => {
    if (audio.current) {
      audio.current.volume = Math.max(0, Math.min(1, volume));
      audio.current.muted = muted;
    }
    sessionStorage.setItem("studio-music-volume", String(volume));
    sessionStorage.setItem("studio-music-muted", String(muted));
  }, [volume, muted, media.audio]);
  useEffect(() => {
    const player = audio.current;
    if (!media.audio || !player) return;
    let active = true;
    const start = () => {
      if (!active) return;
      player.currentTime = previewStart(
        media.previewTime,
        player.duration,
        map?.lastObjectTime,
      );
      setElapsed(player.currentTime);
      player.play().catch((reason) => {
        if (!active || reason.name === "AbortError") return;
        setError(
          reason.name === "NotAllowedError"
            ? t("Браузер заблокировал автозапуск. Нажмите «Слушать карту».")
            : t("Браузер не может воспроизвести этот аудиофайл"),
        );
      });
    };
    if (player.readyState >= 1) start();
    else player.addEventListener("loadedmetadata", start, { once: true });
    return () => {
      active = false;
      player.removeEventListener("loadedmetadata", start);
      player.pause();
    };
  }, [media.audio, media.previewTime]);
  const time = (n: number) =>
    `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
  return (
    <section
      className={`vinyl-stage ${motion ? "" : "still"}`}
      aria-label={t("Музыка карты")}
    >
      <div className="stage-heading">
        <Disc3 size={20} />
        <span>{t("На сцене")}</span>
        <button
          className="text-button"
          aria-pressed={motion}
          onClick={() => {
            setMotion(!motion);
            sessionStorage.setItem("studio-motion", String(!motion));
          }}
        >
          {t("Анимация")}
        </button>
      </div>
      <div className="turntable">
        <div className="approach-ring" />
        <div className="orbit-dot" />
        <div className="vinyl-disc">
          {media.background && (
            <img
              className="vinyl-art"
              src={media.background}
              alt=""
              onError={() => setMedia((m) => ({ ...m, background: null }))}
            />
          )}
          <div className="vinyl-grooves" />
          <div className="vinyl-label">
            <span>danser</span>
            <b>STUDIO</b>
            <small>osu!standard</small>
          </div>
          <div className="spindle" />
        </div>
        <div className="vinyl-reflection" />
        <div className="tonearm">
          <i />
        </div>
      </div>
      <div className="track-title">
        <h1>{map?.title || t("Выберите свой трек")}</h1>
        <p>
          {map
            ? `${map.artist} · ${map.difficulty}`
            : t("Загрузите реплеи или выберите карту")}
        </p>
        {map && (
          <small>
            {t("Карта от")} {map.creator}
          </small>
        )}
      </div>
      <div className="music-player">
        <button
          className="play-track"
          aria-label={playing ? t("Приостановить музыку") : t("Слушать карту")}
          disabled={!media.audio || !duration}
          onClick={async () => {
            if (!audio.current) return;
            setError("");
            if (playing) audio.current.pause();
            else
              try {
                await audio.current.play();
              } catch {
                setError(t("Браузер не может воспроизвести этот аудиофайл"));
              }
          }}
        >
          {playing ? <Pause size={21} /> : <Play size={21} />}
        </button>
        <div className="track-progress">
          <div>
            <span>
              {media.audio ? t("Музыка карты") : t("Музыка не загружена")}
            </span>
            <span>
              {time(elapsed)} / {time(duration)}
            </span>
          </div>
          <input
            aria-label={t("Позиция музыки")}
            type="range"
            min={0}
            max={duration || 1}
            step=".1"
            value={elapsed}
            disabled={!duration}
            onChange={(e) => {
              if (audio.current)
                audio.current.currentTime = Number(e.target.value);
              setElapsed(Number(e.target.value));
            }}
          />
        </div>
        <button
          className="icon-btn"
          aria-label={muted ? t("Включить звук") : t("Выключить звук")}
          aria-pressed={muted}
          onClick={() => setMuted(!muted)}
        >
          {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
        </button>
        <label className="volume-control">
          <span>
            {t("Громкость")} {muted ? "0" : Math.round(volume * 100)}%
          </span>
          <input
            aria-label={t("Громкость музыки")}
            type="range"
            min="0"
            max="1"
            step=".01"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </label>
      </div>
      {error && (
        <p role="status" className="warning">
          {error}
        </p>
      )}
      <audio
        ref={audio}
        src={media.audio ?? undefined}
        preload="metadata"
        onLoadedMetadata={(e) =>
          setDuration(
            Number.isFinite(e.currentTarget.duration)
              ? e.currentTarget.duration
              : 0,
          )
        }
        onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          if (media.audio)
            setError(t("Браузер не может воспроизвести этот аудиофайл"));
        }}
      />
    </section>
  );
}
