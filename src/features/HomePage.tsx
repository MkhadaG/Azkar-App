import { useMemo } from "react";
import type { AppState, NavSection } from "../app/model";
import type { copy } from "../app/locale";
import { Countdown, useNow } from "../components/Countdown";
import { Icon, type IconName } from "../components/Icon";
import { nextPrayer, prayerNames, toZonedInstant, type PrayerSchedule } from "../services/prayer";

const prayerOrder = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;

interface HomePageProps {
  state: AppState;
  text: (typeof copy)["ar"] | (typeof copy)["en"];
  onNavigate: (section: NavSection) => void;
  schedules: PrayerSchedule[];
  loading: boolean;
  error: string;
  refresh: () => void;
}

export function HomePage({ state, text, onNavigate, schedules, loading, error, refresh }: HomePageProps) {
  const { language, location } = state.preferences;
  const timezone = location?.timezone;
  const ar = language === "ar";
  const now = useNow(1000);
  const upcoming = nextPrayer(schedules, now);
  const today = schedules[0];

  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(ar ? "ar" : "en", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }),
    [ar, timezone],
  );
  const quickLinks: { section: NavSection; icon: IconName; title: string; note: string }[] = ar
    ? [
        { section: "quran", icon: "book", title: "القرآن الكريم", note: `سورة ${state.quranSurah} · آية ${state.quranAyah}` },
        { section: "azkar", icon: "sun", title: "أذكار اليوم", note: "الصباح والمساء وبعد الصلاة" },
        { section: "tasbih", icon: "tasbih", title: "السبحة", note: "عدّاد محفوظ على جهازك" },
        { section: "calendar", icon: "calendar", title: "التقويم الهجري", note: "التاريخ والمناسبات" },
      ]
    : [
        { section: "quran", icon: "book", title: "The Quran", note: `Surah ${state.quranSurah}, verse ${state.quranAyah}` },
        { section: "azkar", icon: "sun", title: "Daily adhkar", note: "Morning, evening and after prayer" },
        { section: "tasbih", icon: "tasbih", title: "Tasbih", note: "Counter saved on this device" },
        { section: "calendar", icon: "calendar", title: "Hijri calendar", note: "Dates and occasions" },
      ];

  return (
    <div className="page home-page">
      <section className="card next-card" aria-live="polite">
        <div className="next-top">
          <span className="eyebrow"><span className="live-dot" />{text.nextPrayer}</span>
          {location && <span className="chip chip-static"><Icon name="pin" size={14} />{location.name}</span>}
        </div>

        {!location ? (
          <div className="next-empty">
            <h3>{text.noLocation}</h3>
            <p className="muted">{text.locationHint}</p>
            <button type="button" className="btn btn-primary" onClick={() => onNavigate("settings")}>
              {text.setLocation}
              <Icon name="arrow" flip size={16} />
            </button>
          </div>
        ) : loading && !today ? (
          <p className="muted">{text.loading}</p>
        ) : error && !today ? (
          <div className="notice notice-error">
            <span>{text.noPrayerData}</span>
            <button type="button" className="btn btn-soft" onClick={refresh}>{text.retry}</button>
          </div>
        ) : upcoming ? (
          <div className="next-body">
            <div className="next-main">
              <strong className="next-name">{prayerNames[upcoming.name][language]}</strong>
              <span className="next-time" dir="ltr">{timeFormatter.format(upcoming.at)}</span>
            </div>
            <div className="countdown">
              <span className="muted small">{ar ? "متبقي" : "Time remaining"}</span>
              <Countdown target={upcoming.at} className="countdown-value" />
            </div>
          </div>
        ) : (
          <p className="muted">{text.noPrayerData}</p>
        )}

        <div className="next-foot">
          <span className="muted small">{text.sourceNote}</span>
          <button type="button" className="btn btn-ghost" onClick={() => onNavigate("prayer")}>
            {text.viewAll}
            <Icon name="arrow" flip size={16} />
          </button>
        </div>
      </section>

      {today && (
        <section className="times-strip" aria-label={ar ? "مواقيت اليوم" : "Today's prayers"}>
          {prayerOrder.map((name) => {
            const at = toZonedInstant(today.date, today.timings[name], today.timezone);
            const isNext = upcoming?.name === name && upcoming.at.getTime() === at.getTime();
            return (
              <div className={`time-tile${isNext ? " is-next" : ""}`} key={name}>
                <span>{prayerNames[name][language]}</span>
                <time dir="ltr">{today.timings[name].slice(0, 5)}</time>
              </div>
            );
          })}
        </section>
      )}

      <section className="section">
        <h3 className="section-title">{text.quickAccess}</h3>
        <div className="quick-grid">
          {quickLinks.map((item) => (
            <button type="button" className="card quick-card" key={item.section} onClick={() => onNavigate(item.section)}>
              <span className="quick-icon"><Icon name={item.icon} size={20} /></span>
              <span className="quick-copy">
                <strong>{item.title}</strong>
                <small>{item.note}</small>
              </span>
              <Icon name="arrow" flip size={16} className="quick-arrow" />
            </button>
          ))}
        </div>
      </section>

      <blockquote className="card quote-card">
        <span className="eyebrow">{text.dailyReminder}</span>
        <p>{text.reminderText}</p>
        <cite>{text.source}</cite>
      </blockquote>
    </div>
  );
}
