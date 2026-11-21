import { useEffect, useState } from "react";
import { calculationMethods, type Language, type Location, type Preferences } from "../app/model";
import { copy } from "../app/locale";
import { ensureNotificationPermission, isDesktop } from "../app/desktop";
import { Icon } from "./Icon";
import brandIcon from "../assets/azkar-icon.png";

interface GeocodingResult {
  id: number;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  admin1?: string;
  country_code?: string;
}

const countryCalculationMethods: Record<string, number> = {
  EG: 5, SA: 4, PK: 1, US: 2, CA: 2, AE: 8, KW: 9, QA: 10, SG: 11, TR: 13, IR: 7,
};

interface OnboardingProps {
  preferences: Preferences;
  mode?: "welcome" | "location";
  onComplete: (preferences: Preferences) => void;
  onThemePreview: (theme: Preferences["theme"]) => void;
}

export function Onboarding({ preferences, mode = "welcome", onComplete, onThemePreview }: OnboardingProps) {
  const [draft, setDraft] = useState(preferences);
  const [step, setStep] = useState(mode === "location" ? 1 : 0);
  const [query, setQuery] = useState(preferences.location ? `${preferences.location.name}, ${preferences.location.country}` : "");
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ar = draft.language === "ar";
  const text = copy[draft.language];

  useEffect(() => {
    if (draft.location && query === `${draft.location.name}, ${draft.location.country}`) {
      setResults([]);
      return;
    }
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      setError("");
      try {
        const params = new URLSearchParams({ name: query.trim(), count: "6", language: draft.language, format: "json" });
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`City search failed (${response.status}).`);
        const payload = (await response.json()) as { results?: GeocodingResult[] };
        setResults(payload.results ?? []);
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "City search failed.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, draft.language, draft.location]);

  function chooseLocation(result: GeocodingResult) {
    const location: Location = {
      name: result.name,
      country: result.country,
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone,
    };
    setDraft((current) => ({
      ...current,
      location,
      calculationMethod: countryCalculationMethods[result.country_code ?? ""] ?? 3,
    }));
    setQuery(`${result.name}, ${result.country}`);
    setResults([]);
  }

  async function toggleNotifications() {
    if (draft.notificationsEnabled) {
      setDraft((current) => ({ ...current, notificationsEnabled: false }));
      return;
    }
    if (!isDesktop()) {
      setError(ar ? "تفعيل التنبيهات متاح في تطبيق سطح المكتب." : "Notifications can be enabled in the desktop app.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const granted = await ensureNotificationPermission();
      setDraft((current) => ({ ...current, notificationsEnabled: granted }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Notification permission failed.");
    } finally {
      setBusy(false);
    }
  }

  function setLanguage(language: Language) {
    setDraft((current) => ({ ...current, language }));
  }

  return (
    <main className="onboarding" dir={ar ? "rtl" : "ltr"}>
      <section className="card onboard-card" aria-labelledby="welcome-title">
        <div className="onboard-brand">
          <img src={brandIcon} alt="" width={36} height={36} />
          <span className="brand-name" lang="ar">أذكار</span>
          {mode !== "location" && <div className="steps" aria-label={`${step + 1} / 2`}>
            <span className={step === 0 ? "on" : ""} />
            <span className={step === 1 ? "on" : ""} />
          </div>}
        </div>

        {step === 0 ? (
          <div className="onboard-body">
            <span className="eyebrow">{ar ? "الإعداد الأول" : "First-time setup"}</span>
            <h1 id="welcome-title">{ar ? "مرحبًا بك في أذكار" : "Welcome to Azkar"}</h1>
            <p className="lead">
              {ar
                ? "مواقيت الصلاة، وقراءة القرآن، والأذكار اليومية. يُحفظ تقدمك على هذا الجهاز."
                : "Prayer times, Quran reading and daily adhkar. Your progress is saved on this device."}
            </p>
            <div className="field">
              <span className="field-label"><Icon name="globe" size={16} /> {text.language}</span>
              <div className="seg">
                <button type="button" className={draft.language === "ar" ? "on" : ""} onClick={() => setLanguage("ar")}>العربية</button>
                <button type="button" className={draft.language === "en" ? "on" : ""} onClick={() => setLanguage("en")}>English</button>
              </div>
            </div>
            <div className="onboard-actions">
              <button type="button" className="btn btn-primary" onClick={() => setStep(1)}>
                {ar ? "لنبدأ" : "Set up Azkar"}
                <Icon name="arrow" flip size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="onboard-body">
            <span className="eyebrow">{mode === "location" ? (ar ? "تحديث الموقع" : "UPDATE LOCATION") : (ar ? "خطوة أخيرة" : "A few preferences")}</span>
            <h1 id="welcome-title">{mode === "location" ? (ar ? "اختر موقعك" : "Choose your location") : (ar ? "إعدادات التطبيق" : "Set your preferences")}</h1>
            <p className="lead">{mode === "location" ? (ar ? "ابحث عن مدينتك لحساب مواقيت الصلاة محليًا." : "Search for your city to calculate local prayer times.") : (ar ? "كل شيء اختياري، ويمكنك تغييره متى شئت." : "Everything is optional and can be changed at any time.")}</p>

            <div className="field">
              <label className="field-label" htmlFor="city-search"><Icon name="pin" size={16} /> {text.location}</label>
              <div className="search-box">
                <input
                  id="city-search"
                  className="input"
                  value={query}
                  placeholder={text.selectLocation}
                  autoComplete="off"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setDraft((current) => ({ ...current, location: null }));
                  }}
                />
                <Icon name={searching ? "clock" : "search"} size={18} className="search-icon" />
                {results.length > 0 && (
                  <ul className="results" role="listbox">
                    {results.map((result) => (
                      <li key={result.id}>
                        <button type="button" role="option" aria-selected={false} onClick={() => chooseLocation(result)}>
                          <strong>{result.name}</strong>
                          <small>{[result.admin1, result.country].filter(Boolean).join(" · ")}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="muted small">{text.locationHint} {text.locationPermission}</p>
              {draft.location && (
                <p className="selected-location"><Icon name="check" size={15} />{draft.location.name}, {draft.location.country}</p>
              )}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="calculation-method">{text.method}</label>
              <select
                id="calculation-method"
                className="input"
                value={draft.calculationMethod}
                onChange={(event) => setDraft((current) => ({ ...current, calculationMethod: Number(event.target.value) }))}
              >
                {calculationMethods.map((method) => (
                  <option value={method.id} key={method.id}>{ar ? method.ar : method.en}</option>
                ))}
              </select>
            </div>

            {mode !== "location" && <div className="field">
              <span className="field-label">{text.theme}</span>
              <div className="seg">
                <button type="button" className={draft.theme === "light" ? "on" : ""} onClick={() => { setDraft((current) => ({ ...current, theme: "light" })); onThemePreview("light"); }}>
                  <Icon name="light" size={15} />{text.light}
                </button>
                <button type="button" className={draft.theme === "dark" ? "on" : ""} onClick={() => { setDraft((current) => ({ ...current, theme: "dark" })); onThemePreview("dark"); }}>
                  <Icon name="dark" size={15} />{text.dark}
                </button>
              </div>
            </div>}

            {mode !== "location" && <div className="notify-choice">
              <div className="grow">
                <strong>{text.notifications}</strong>
                <p className="muted small">
                  {draft.notificationsEnabled
                    ? (ar ? "ستصلك تذكيرات الصلاة أثناء تشغيل التطبيق." : "Prayer reminders while Azkar is running.")
                    : (ar ? "اختياري — ويمكن تفعيله لاحقًا." : "Optional — you can enable this later.")}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={draft.notificationsEnabled}
                className="switch"
                disabled={busy}
                onClick={() => void toggleNotifications()}
                aria-label={text.notifications}
              />
            </div>}

            {error && <p className="notice notice-error" role="alert">{error}</p>}

            <div className="onboard-actions">
              {mode !== "location" && <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>{text.back}</button>}
              {mode === "location" && <button type="button" className="btn btn-ghost" onClick={() => onComplete(preferences)}>{text.cancel}</button>}
              <button type="button" className="btn btn-primary" onClick={() => onComplete(draft)}>
                {mode === "location" ? (ar ? "حفظ الموقع" : "Save location") : (ar ? "الدخول إلى أذكار" : "Enter Azkar")}
                <Icon name="arrow" flip size={16} />
              </button>
            </div>
          </div>
        )}
      </section>
      {mode !== "location" && <footer className="onboard-footer">
        {ar ? "تُحفظ إعداداتك محليًا على جهازك." : "Your settings are stored locally on this device."}
      </footer>}
    </main>
  );
}
