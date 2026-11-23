import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { calculationMethods, type AppState } from "../app/model";
import type { copy } from "../app/locale";
import { Icon } from "../components/Icon";

interface SettingsPageProps {
  state: AppState;
  text: (typeof copy)["ar"] | (typeof copy)["en"];
  onChange: (update: (state: AppState) => AppState) => void;
  onEditLocation: () => void;
}

export function SettingsPage({ state, text, onChange, onEditLocation }: SettingsPageProps) {
  const { language, theme, location, calculationMethod } = state.preferences;
  const ar = language === "ar";
  const desktop = isTauri();
  const [startupEnabled, setStartupEnabled] = useState(false);
  const [startupLoading, setStartupLoading] = useState(true);
  const [systemBusy, setSystemBusy] = useState(false);
  const [systemError, setSystemError] = useState("");

  useEffect(() => {
    if (!desktop) {
      setStartupLoading(false);
      return;
    }
    let active = true;
    void invoke<boolean>("is_open_on_startup")
      .then((enabled) => { if (active) setStartupEnabled(enabled); })
      .catch((reason: unknown) => {
        if (active) setSystemError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => { if (active) setStartupLoading(false); });
    return () => { active = false; };
  }, [desktop]);

  function updatePreferences(update: Partial<AppState["preferences"]>) {
    onChange((current) => ({ ...current, preferences: { ...current.preferences, ...update } }));
  }

  async function toggleStartup() {
    const enabled = !startupEnabled;
    setSystemBusy(true);
    setSystemError("");
    try {
      await invoke("set_open_on_startup", { enabled });
      setStartupEnabled(enabled);
    } catch (reason) {
      setSystemError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSystemBusy(false);
    }
  }

  async function updateTaskbarWidgetSettings(enabled: boolean) {
    setSystemBusy(true);
    setSystemError("");
    try {
      await invoke("set_taskbar_widget", { enabled });
      updatePreferences({ taskbarWidgetEnabled: enabled });
    } catch (reason) {
      setSystemError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSystemBusy(false);
    }
  }

  return (
    <div className="page settings-page">
      <section className="card card-hero">
        <div>
          <span className="eyebrow">{ar ? "إعدادات التطبيق" : "App settings"}</span>
          <h2>{ar ? "التفضيلات" : "Preferences"}</h2>
          <p className="lead">{ar ? "تخصيص اللغة والمظهر ومواقيت الصلاة." : "Configure language, appearance and prayer times."}</p>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <div><h3>{text.language}</h3><p className="muted small">{ar ? "لغة الواجهة والاتجاه" : "Interface language and direction"}</p></div>
            <Icon name="globe" size={20} className="muted" />
          </div>
          <div className="seg">
            <button type="button" className={language === "ar" ? "on" : ""} onClick={() => updatePreferences({ language: "ar" })}>العربية</button>
            <button type="button" className={language === "en" ? "on" : ""} onClick={() => updatePreferences({ language: "en" })}>English</button>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div><h3>{text.theme}</h3><p className="muted small">{ar ? "اختر مظهرًا مريحًا لعينيك" : "Choose a comfortable appearance"}</p></div>
            <Icon name={theme === "light" ? "light" : "dark"} size={20} className="muted" />
          </div>
          <div className="seg">
            <button type="button" className={theme === "light" ? "on" : ""} onClick={() => updatePreferences({ theme: "light" })}>
              <Icon name="light" size={16} />{text.light}
            </button>
            <button type="button" className={theme === "dark" ? "on" : ""} onClick={() => updatePreferences({ theme: "dark" })}>
              <Icon name="dark" size={16} />{text.dark}
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h3>{text.location}</h3>
              <p className="muted small">{location ? `${location.name}, ${location.country}` : (ar ? "لم يتم اختيار موقع" : "No location selected")}</p>
            </div>
            <Icon name="pin" size={20} className="muted" />
          </div>
          {location && (
            <p className="small muted" dir="ltr">
              {location.latitude.toFixed(3)}, {location.longitude.toFixed(3)} · {location.timezone}
            </p>
          )}
          <button
            type="button"
            className="btn btn-outline"
            onClick={onEditLocation}
          >
            {location ? (ar ? "تغيير الموقع" : "Change location") : text.setLocation}
            <Icon name="arrow" flip size={15} />
          </button>
          <p className="muted small footnote">{text.locationHint} {text.locationPermission}</p>
        </section>

        <section className="card">
          <div className="card-head">
            <div><h3>{text.method}</h3><p className="muted small">{ar ? "اختر الطريقة الأقرب للجدول المعتمد في منطقتك" : "Choose the method used by your local prayer timetable"}</p></div>
            <Icon name="moon" size={20} className="muted" />
          </div>
          <select
            className="input"
            value={calculationMethod}
            onChange={(event) => updatePreferences({ calculationMethod: Number(event.target.value) })}
          >
            {calculationMethods.map((method) => (
              <option value={method.id} key={method.id}>{ar ? method.ar : method.en}</option>
            ))}
          </select>
        </section>
      </div>


      <section className="card system-settings-card">
        <div className="card-head">
          <div>
            <h3>{ar ? "إعدادات النظام" : "System settings"}</h3>
            <p className="muted small">{ar ? "تحكم في تشغيل أذكار وظهورها مع Windows." : "Control how Azkar runs alongside Windows."}</p>
          </div>
          <Icon name="settings" size={20} className="muted" />
        </div>

        <div className="system-toggle-list">
          <div className="system-toggle-row">
            <div className="system-toggle-copy">
              <strong>{ar ? "الفتح عند بدء التشغيل" : "Open on startup"}</strong>
              <span>{ar ? "تشغيل أذكار تلقائيًا مع Windows وإبقاؤه في منطقة النظام." : "Launch Azkar with Windows and keep it running in the system tray."}</span>
            </div>
            <button
              type="button"
              role="switch"
              className="switch"
              aria-checked={startupEnabled}
              aria-label={ar ? "الفتح عند بدء التشغيل" : "Open on startup"}
              disabled={!desktop || startupLoading || systemBusy}
              onClick={() => void toggleStartup()}
            />
          </div>

          <div className="system-toggle-row">
            <div className="system-toggle-copy">
              <strong>{ar ? "أداة مواقيت الصلاة على شريط المهام" : "Taskbar prayer widget"}</strong>
              <span>{ar ? "يعرض الصلاة القادمة والوقت المتبقي مباشرة داخل شريط مهام Windows بجوار منطقة الإشعارات." : "Shows the next prayer and live countdown directly inside the Windows taskbar, beside the system notification area."}</span>
            </div>
            <button
              type="button"
              role="switch"
              className="switch"
              aria-checked={state.preferences.taskbarWidgetEnabled}
              aria-label={ar ? "أداة مواقيت الصلاة على شريط المهام" : "Taskbar prayer widget"}
              disabled={!desktop || systemBusy}
              onClick={() => void updateTaskbarWidgetSettings(!state.preferences.taskbarWidgetEnabled)}
            />
          </div>
        </div>
        <p className="muted small system-settings-note">
          {ar
            ? "تُرسم الأداة مباشرة باستخدام نافذة Windows شفافة لكل بكسل، وتُعاد مزامنتها تلقائيًا عند تحديث شريط المهام."
            : "The indicator is drawn as a native per-pixel transparent Windows window and automatically reattaches when the taskbar refreshes."}
        </p>
        {systemError && <p className="system-settings-error" role="alert">{systemError}</p>}
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h3>{ar ? "الخصوصية والبيانات" : "Privacy & data"}</h3>
            <p className="muted small">{ar ? "لا يلزمك حساب لاستخدام أذكار." : "No account is needed to use Azkar."}</p>
          </div>
          <Icon name="check" size={20} className="muted" />
        </div>
        <ul className="plain-list">
          <li>{ar ? "تُحفظ التفضيلات والتقدم على هذا الجهاز فقط." : "Preferences and progress are stored only on this device."}</li>
          <li>{ar ? "تُحسب مواقيت الصلاة على جهازك، ويُستخدم الإنترنت للبحث عن المدن وجلب نص القرآن." : "Prayer times are calculated on your device. Internet is used for city search and Quran text."}</li>
          <li>{ar ? "موقعك يُستخدم لحساب المواقيت فقط، ولا نطلب موقع الجهاز." : "Your city is used only to calculate prayer times. Device location is never requested."}</li>
        </ul>
      </section>
    </div>
  );
}
