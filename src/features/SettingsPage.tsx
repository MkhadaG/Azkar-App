import { calculationMethods, type AppState } from "../app/model";
import { prayerNames } from "../services/prayer";
import type { copy } from "../app/locale";
import { Icon } from "../components/Icon";

type AdjustablePrayer = "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";
const adjustablePrayers: AdjustablePrayer[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

interface SettingsPageProps {
  state: AppState;
  text: (typeof copy)["ar"] | (typeof copy)["en"];
  onChange: (update: (state: AppState) => AppState) => void;
}

export function SettingsPage({ state, text, onChange }: SettingsPageProps) {
  const { language, theme, location, calculationMethod } = state.preferences;
  const ar = language === "ar";

  function setAdjustment(name: AdjustablePrayer, minutes: number) {
    updatePreferences({
      prayerAdjustments: { ...state.preferences.prayerAdjustments, [name]: Math.max(-30, Math.min(30, minutes)) },
    });
  }

  function updatePreferences(update: Partial<AppState["preferences"]>) {
    onChange((current) => ({ ...current, preferences: { ...current.preferences, ...update } }));
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
            onClick={() => onChange((current) => ({ ...current, hasCompletedOnboarding: false }))}
          >
            {location ? (ar ? "تغيير الموقع" : "Change location") : text.setLocation}
            <Icon name="arrow" flip size={15} />
          </button>
          <p className="muted small footnote">{text.locationHint} {text.locationPermission}</p>
        </section>

        <section className="card">
          <div className="card-head">
            <div><h3>{text.method}</h3><p className="muted small">{ar ? "يتأثر وقت الصلاة بالطريقة المختارة" : "Prayer times vary by calculation method"}</p></div>
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

      <section className="card adjust-card">
        <div className="card-head">
          <div>
            <h3>{ar ? "تعديل المواقيت بالدقائق" : "Fine-tune prayer times"}</h3>
            <p className="muted small">
              {ar
                ? "إذا اختلف الوقت عن جدول مسجدك، عدّل الدقائق هنا من -30 إلى +30."
                : "If your mosque's timetable differs, adjust the minutes here (−30 to +30)."}
            </p>
          </div>
        </div>
        <div className="adjust-list">
          {adjustablePrayers.map((name) => {
            const value = state.preferences.prayerAdjustments[name];
            return (
              <div className="adjust-row" key={name}>
                <span className="list-title">{prayerNames[name][language]}</span>
                <div className="stepper">
                  <button type="button" className="btn btn-icon btn-outline" onClick={() => setAdjustment(name, value - 1)} disabled={value <= -30} aria-label={ar ? "تقديم دقيقة" : "Minus one minute"}>
                    <Icon name="minus" size={16} />
                  </button>
                  <span className="stepper-value">{value > 0 ? `+${value}` : value}</span>
                  <button type="button" className="btn btn-icon btn-outline" onClick={() => setAdjustment(name, value + 1)} disabled={value >= 30} aria-label={ar ? "زيادة دقيقة" : "Plus one minute"}>
                    <Icon name="plus" size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => updatePreferences({ prayerAdjustments: { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 } })}
        >
          {ar ? "إعادة الضبط" : "Reset adjustments"}
        </button>
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
          <li>{ar ? "تُطلب مواقيت الصلاة والقرآن عبر الإنترنت، وتُخزَّن الصفحات التي فتحتها على الجهاز." : "Prayer times and Quran text are fetched online; pages you open are cached on this device."}</li>
          <li>{ar ? "موقعك يُستخدم لحساب المواقيت فقط، ولا نطلب موقع الجهاز." : "Your city is used only to calculate prayer times. Device location is never requested."}</li>
        </ul>
      </section>
    </div>
  );
}
