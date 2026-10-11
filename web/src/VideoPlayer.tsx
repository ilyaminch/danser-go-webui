import { useRef, useState } from "react";
import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { t } from "./i18n";

const time = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export function VideoPlayer({ src }: { src: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState(false);
  const [playBlocked, setPlayBlocked] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const toggle = async () => {
    if (!video.current) return;
    if (video.current.paused) {
      try {
        await video.current.play();
      } catch (reason) {
        // Pausing or seeking while play() is pending can cancel it normally.
        if (!(reason instanceof DOMException && reason.name === "AbortError"))
          setPlayBlocked(true);
      }
    } else video.current.pause();
  };
  return (
    <div ref={host} className="video-player">
      <div className="video-surface">
        <video
          ref={video}
          src={src}
          playsInline
          preload="metadata"
          onPlay={() => {
            setPlaying(true);
            setPlayBlocked(false);
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) =>
            setDuration(
              Number.isFinite(e.currentTarget.duration)
                ? e.currentTarget.duration
                : 0,
            )
          }
          onWaiting={() => setWaiting(true)}
          onPlaying={() => setWaiting(false)}
          onCanPlay={() => setWaiting(false)}
          onError={() => {
            setError(true);
            setWaiting(false);
          }}
        />
        {!playing && !error && (
          <button
            className="video-play-overlay"
            aria-label={t("Воспроизвести")}
            onClick={() => void toggle()}
          >
            <Play size={32} />
          </button>
        )}
        {waiting && (
          <span className="video-message" role="status">
            {t("Загрузка видео…")}
          </span>
        )}
        {playBlocked && !error && (
          <p className="video-message" role="status">
            {t("Нажмите «Воспроизвести», чтобы запустить видео.")}
          </p>
        )}
        {error && (
          <p className="video-message" role="alert">
            {t(
              "Браузер не может воспроизвести этот формат. Скачайте файл и откройте его в видеоплеере.",
            )}
          </p>
        )}
      </div>
      <div className="video-controls">
        <button
          className="icon-btn"
          disabled={error}
          aria-label={playing ? t("Пауза") : t("Воспроизвести")}
          onClick={() => void toggle()}
        >
          {playing ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <span className="video-time">
          {time(current)} / {time(duration)}
        </span>
        <input
          className="video-seek"
          type="range"
          aria-label={t("Позиция видео")}
          aria-valuetext={time(current)}
          min={0}
          max={duration || 1}
          step={0.1}
          value={current}
          disabled={!duration || error}
          onChange={(e) => {
            const v = +e.target.value;
            if (video.current) video.current.currentTime = v;
            setCurrent(v);
          }}
        />
        <button
          className="icon-btn"
          aria-label={muted ? t("Включить звук") : t("Выключить звук")}
          onClick={() => {
            if (video.current) video.current.muted = !muted;
            setMuted(!muted);
          }}
        >
          {muted || volume === 0 ? (
            <VolumeX size={20} />
          ) : (
            <Volume2 size={20} />
          )}
        </button>
        <input
          className="video-volume"
          type="range"
          aria-label={t("Громкость видео")}
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(e) => {
            const v = +e.target.value;
            if (video.current) {
              video.current.volume = v;
              video.current.muted = false;
            }
            setVolume(v);
            setMuted(false);
          }}
        />
        <button
          className="icon-btn"
          aria-label={t("Полный экран")}
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void host.current?.requestFullscreen().catch(() => {});
          }}
        >
          <Maximize size={20} />
        </button>
      </div>
    </div>
  );
}
