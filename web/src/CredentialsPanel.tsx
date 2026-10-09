import { t } from "./i18n";
import { useEffect, useState } from "react";
import { Check, KeyRound } from "lucide-react";
export function CredentialsPanel() {
  const [credentials, setCredentials] = useState({
    ClientId: "",
    ClientSecret: "",
    AuthType: "ClientCredentials",
    CallbackPort: 8294,
    hasSecret: false,
    hasToken: false,
    clearToken: false,
  });
  const [message, setMessage] = useState(""),
    [loading, setLoading] = useState(false);
  const update = (key: string, value: unknown) =>
    setCredentials((c) => ({ ...c, [key]: value }));
  useEffect(() => {
    fetch("/api/credentials")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setCredentials((c) => ({ ...c, ...data }));
      })
      .catch((e) => setMessage(e.message));
  }, []);
  return (
    <>
      <h2>
        <KeyRound size={18} /> {t("Авторизация osu!")}
      </h2>
      <p className="note">
        {t(
          "Локальные реплеи работают без авторизации. Для онлайн-таблиц нужны данные приложения osu! API. Они сохраняются только в settings/credentials.json движка отдельно от параметров рендера.",
        )}
      </p>
      <label className="field">
        <span>Client ID</span>
        <input
          value={credentials.ClientId}
          onChange={(e) => update("ClientId", e.target.value)}
        />
      </label>
      <label className="field">
        <span>Client Secret</span>
        <input
          type="password"
          autoComplete="new-password"
          value={credentials.ClientSecret}
          placeholder={
            credentials.hasSecret
              ? t("Секрет сохранён · оставьте пустым, чтобы сохранить")
              : t("Введите Client Secret")
          }
          onChange={(e) => update("ClientSecret", e.target.value)}
        />
      </label>
      <label className="field">
        <span>{t("Тип авторизации")}</span>
        <select
          value={credentials.AuthType}
          onChange={(e) => update("AuthType", e.target.value)}
        >
          <option value="ClientCredentials">
            {t("Client credentials · анонимный API")}
          </option>
          <option value="AuthorizationCode">
            {t("Authorization code · ваш аккаунт")}
          </option>
        </select>
      </label>
      {credentials.AuthType === "AuthorizationCode" && (
        <label className="field">
          <span>{t("Порт обратного вызова")}</span>
          <input
            type="number"
            min="1"
            max="65535"
            value={credentials.CallbackPort}
            onChange={(e) => update("CallbackPort", Number(e.target.value))}
          />
          <small>
            {t(
              "Вход выполняется средствами danser, когда функция обращается к API osu!. Разрешения подтверждаются на стороне osu!.",
            )}
          </small>
        </label>
      )}
      <label className="toggle-row">
        <span>{t("Сбросить сохранённые токены при сохранении")}</span>
        <input
          type="checkbox"
          checked={credentials.clearToken}
          onChange={(e) => update("clearToken", e.target.checked)}
        />
        <i />
      </label>
      <p className="note">
        {credentials.hasToken
          ? t("Токен уже сохранён движком.")
          : t("Сохранённого токена пока нет.")}
      </p>
      <button
        className="button primary"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          try {
            const response = await fetch("/api/credentials", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "X-Studio-Client": "1",
              },
              body: JSON.stringify(credentials),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setMessage(
              t("Данные авторизации сохранены отдельно от параметров рендера"),
            );
            setCredentials((c) => ({
              ...c,
              ClientSecret: "",
              hasSecret: c.hasSecret || !!c.ClientSecret,
              clearToken: false,
            }));
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setLoading(false);
          }
        }}
      >
        <Check size={16} />
        {t("Сохранить авторизацию")}
      </button>
      {message && (
        <p role="status" className="note">
          {message}
        </p>
      )}
    </>
  );
}
