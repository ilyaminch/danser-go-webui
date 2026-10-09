import { t } from "./i18n";
import { FolderOpen, RefreshCw } from "lucide-react";

export function LazerConnection({
  value,
  onChange,
  onDetect,
  onConnect,
  busy,
}: {
  value: string;
  onChange: (value: string) => void;
  onDetect: () => void;
  onConnect: () => void;
  busy: boolean;
}) {
  return (
    <div className="schema-group">
      <h2>{t("Хранилище osu!lazer")}</h2>
      <p className="note">
        {t(
          "Используется как справочник карт: точная карта находится по хэшу из реплея. Музыка, фон и остальные файлы остаются в lazer. Для рендера создаются временные ссылки.",
        )}
      </p>
      <label className="field">
        <span>{t("Корневая папка lazer")}</span>
        <input
          aria-label={t("Корневая папка lazer")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="C:\Users\…\AppData\Roaming\osu"
        />
        <small>
          {t(
            "Папка с client.realm и files. Отдельные пути Songs, Skins и Replays для lazer не используются.",
          )}
        </small>
      </label>
      <p className="note">
        {t(
          "Скины импортируйте как .osk, реплеи — как экспортированные .osr одной карты. Приложение пока не читает их напрямую из базы lazer.",
        )}
      </p>
      {value.trim() && (
        <p className="note">
          {t("Обычная папка экспорта lazer:")}{" "}
          <code>
            {value.replace(/[\\/]+$/, "")}
            {value.includes("\\") ? "\\" : "/"}exports
          </code>
          {t(
            ". Здесь находятся только файлы, которые вы экспортировали из игры.",
          )}
        </p>
      )}
      <div className="split">
        <button className="button ghost" disabled={busy} onClick={onDetect}>
          <FolderOpen size={16} />
          {t("Найти на компьютере")}
        </button>
        <button
          className="button primary"
          disabled={busy || !value.trim()}
          onClick={onConnect}
        >
          <RefreshCw size={16} />
          {t("Подключить и обновить индекс")}
        </button>
      </div>
    </div>
  );
}
