import { calculationMethods, type AppState } from "../app/model";
import type { copy } from "../app/locale";
import { Countdown, useNow } from "../components/Countdown";
import { Icon, type IconName } from "../components/Icon";
import { nextPrayer, prayerNames, toZonedInstant, type PrayerName, type PrayerSchedule } from "../services/prayer";

const prayerIcons: Record<PrayerName, IconName> = {
  Fajr: "sunrise",
  Sunrise: "sun",
  Dhuhr: "midday",
  Asr: "afternoon",
  Maghrib: "sunset",
  Isha: "moon",
};
const listedPrayers: PrayerName[] = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];

interface PrayerPageProps {
  state: AppState;
  text: (typeof copy)["ar"] | (typeof copy)["en"];
  onOpenSettings: () => void;
  schedules: PrayerSchedule[];
  loading: boolean;
  error: string;
  refresh: () => void;
}

export function PrayerPage({ state, text, onOpenSettings, schedules, loading, error, refresh }: PrayerPageProps) {
  const { language, location, calculationMethod } = state.preferences;
  const ar = language === "ar";
  const now = useNow(1000);
  const today = schedules[0];
  const upcoming = nextPrayer(schedules, now);
  const timeFormatter = new Intl.DateTimeFormat(ar ? "ar" : "en", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: location?.timezone });
  const method = calculationMethods.find((item) => item.id === calculationMethod);

  if (!location) {
    return (
      <div className="page">
        <section className="card empty-card">
          <span className="empty-icon"><Icon name="pin" size={24} /></span>
          <h2>{text.noLocation}</h2>
          <p className="muted">{text.locationHint}</p>
          <button type="button" className="btn btn-primary" onClick={onOpenSettings}>
            {text.setLocation}
            <Icon name="arrow" flip size={16} />
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="page prayer-page">
      <section className="card card-hero prayer-hero">
        <div className="next-top">
          <span className="eyebrow"><Icon name="pin" size={14} />{location.name}, {location.country}</span>
          {today && (
            <span className="muted small">
              {new Intl.DateTimeFormat(ar ? "ar" : "en", { weekday: "long", day: "numeric", month: "long", timeZone: location.timezone })
                .format(toZonedInstant(today.date, "12:00", location.timezone))}
            </span>
          )}
        </div>

        {loading && !today ? (
          <p className="lead">{text.loading}</p>
        ) : error && !today ? (
          <div className="notice notice-error">
            <span>{text.noPrayerData}</span>
            <button type="button" className="btn btn-soft" onClick={refresh}>{text.retry}</button>
          </div>
        ) : upcoming ? (
          <div className="next-body">
            <div className="next-main">
              <span className="muted">{text.nextPrayer}</span>
              <strong className="next-name">{prayerNames[upcoming.name][language]}</strong>
              <span className="next-time" dir="ltr">{timeFormatter.format(upcoming.at)}</span>
            </div>
            <div className="countdown">
              <span className="muted small">{ar ? "متبقي" : "Time remaining"}</span>
              <Countdown target={upcoming.at} className="countdown-value" />
            </div>
          </div>
        ) : null}

        <div className="next-foot">
          <span className="muted small"><Icon name="globe" size={14} /> {text.timeFormat}: {location.timezone}</span>
          <button type="button" className="btn btn-ghost" onClick={onOpenSettings}>
            {text.editSettings}
            <Icon name="arrow" flip size={16} />
          </button>
        </div>
      </section>

      {today && (
        <section className="card">
          <div className="card-head">
            <div>
              <span className="eyebrow">{ar ? "مواقيت اليوم" : "Today's schedule"}</span>
              <h2>{ar ? "الصلوات الخمس" : "The five prayers"}</h2>
            </div>
            {today.cached && <span className="badge">{ar ? "من الذاكرة" : "Cached"}</span>}
          </div>
          <div className="list">
            {listedPrayers.map((name) => {
              const at = toZonedInstant(today.date, today.timings[name], today.timezone);
              const isNext = upcoming?.name === name && upcoming.at.getTime() === at.getTime();
              return (
                <div className={`list-row${isNext ? " is-next" : ""}`} key={name}>
                  <span className="list-icon"><Icon name={prayerIcons[name]} size={18} /></span>
                  <span className="list-title">{prayerNames[name][language]}</span>
                  {isNext && <span className="badge badge-gold">{ar ? "القادمة" : "Up next"}</span>}
                  <time dir="ltr" className="list-time">{new Intl.DateTimeFormat(ar ? "ar" : "en", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: today.timezone }).format(at)}</time>
                </div>
              );
            })}
          </div>
          <p className="muted small footnote">
            {ar ? "تُحسب المواقيت على جهازك حسب موقعك وطريقة الحساب المختارة." : "Prayer times are calculated on this device using your location and selected method."}{method ? ` · ${ar ? method.ar : method.en}` : ""}
          </p>
        </section>
      )}
    </div>
  );
}
