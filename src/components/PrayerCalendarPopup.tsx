import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppState } from "../app/model";
import type { PrayerName, PrayerSchedule } from "../services/prayer";
import { nextPrayer, prayerNames, toZonedInstant } from "../services/prayer";

interface Props {
  state: AppState;
  schedules: PrayerSchedule[];
}

const prayerOrder: Exclude<PrayerName, "Sunrise">[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export function PrayerCalendarPopup({ state, schedules }: Props) {
  const ar = state.preferences.language === "ar";
  const timezone = state.preferences.location?.timezone;
  const [tick, setTick] = useState(() => Date.now());
  const [animationKey, setAnimationKey] = useState(0);
  const [displayTheme, setDisplayTheme] = useState(state.preferences.theme);

  useEffect(() => {
    setDisplayTheme(state.preferences.theme);
  }, [state.preferences.theme]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    const replay = () => setAnimationKey((value) => value + 1);
    const changeTheme = (event: Event) => {
      const theme = (event as CustomEvent<unknown>).detail;
      if (theme === "light" || theme === "dark") setDisplayTheme(theme);
    };
    window.addEventListener("azkar-prayer-calendar-open", replay);
    window.addEventListener("azkar-prayer-calendar-theme", changeTheme);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") void invoke("close_prayer_calendar");
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("azkar-prayer-calendar-open", replay);
      window.removeEventListener("azkar-prayer-calendar-theme", changeTheme);
      window.removeEventListener("keydown", escape);
    };
  }, []);

  const now = new Date(tick);
  const upcoming = useMemo(() => nextPrayer(schedules, now), [schedules, tick]);
  const today = schedules[0];
  const previous = useMemo(() => {
    if (!upcoming) return null;
    return schedules.flatMap((schedule) => prayerOrder.map((name) => ({
      name,
      at: toZonedInstant(schedule.date, schedule.timings[name], schedule.timezone),
    }))).filter((entry) => entry.at.getTime() <= tick).sort((a, b) => b.at.getTime() - a.at.getTime())[0] ?? null;
  }, [schedules, upcoming, tick]);
  const remaining = upcoming ? upcoming.at.getTime() - tick : 0;
  const interval = upcoming && previous ? upcoming.at.getTime() - previous.at.getTime() : 0;
  const progress = interval > 0 && previous && upcoming
    ? Math.max(0, Math.min(100, ((tick - previous.at.getTime()) / interval) * 100))
    : 0;
  const prayerTime = upcoming
    ? new Intl.DateTimeFormat(ar ? "ar" : "en", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: timezone }).format(upcoming.at)
    : "—";
  const dateLabel = new Intl.DateTimeFormat(ar ? "ar" : "en", {
    weekday: "long", day: "numeric", month: "long", timeZone: timezone,
  }).format(now);
  const todayRows = today ? prayerOrder.map((name) => {
    const at = toZonedInstant(today.date, today.timings[name], today.timezone);
    const isNext = !!upcoming && at.getTime() === upcoming.at.getTime();
    return { name, at, isNext, isPast: at.getTime() < tick };
  }) : [];

  return (
    <main className={`prayer-calendar-root ${displayTheme === "light" ? "is-light" : "is-dark"} ${ar ? "is-ar" : "is-en"}`} dir={ar ? "rtl" : "ltr"}>
      <section className="prayer-calendar-panel" key={animationKey} role="dialog" aria-label={ar ? "مواقيت الصلاة" : "Prayer timetable"}>
        <header className="prayer-calendar-header">
          <div className="prayer-calendar-heading">
            <span className="prayer-calendar-eyebrow">{ar ? "مواقيت الصلاة" : "PRAYER TIMES"}</span>
            <h1>{dateLabel}</h1>
            <p>{state.preferences.location?.name ?? (ar ? "لم يتم تحديد الموقع" : "Location not set")}</p>
          </div>
        </header>

        <section className="prayer-calendar-next">
          <span className="prayer-calendar-next-label">{ar ? "الصلاة القادمة" : "UP NEXT"}</span>
          <div className="prayer-calendar-next-row">
            <h2>{upcoming ? prayerNames[upcoming.name][ar ? "ar" : "en"] : (ar ? "غير متاح" : "Unavailable")}</h2>
            <strong>{prayerTime}</strong>
          </div>
          <div className="prayer-calendar-count-row">
            <span>{ar ? "الوقت المتبقي" : "TIME REMAINING"}</span>
            <time dir="ltr">{upcoming ? formatCountdown(remaining) : "--:--:--"}</time>
          </div>
          <div className="prayer-calendar-progress"><span style={{ width: `${progress}%` }} /></div>
        </section>

        <section className="prayer-calendar-list">
          <div className="prayer-calendar-list-heading">
            <h3>{ar ? "مواقيت اليوم" : "TODAY'S SCHEDULE"}</h3>
            <span>{ar ? "حسب موقعك" : "LOCAL TIME"}</span>
          </div>
          {todayRows.map((row) => (
            <div className={`prayer-calendar-row${row.isNext ? " is-next" : ""}${row.isPast && !row.isNext ? " is-past" : ""}`} key={row.name}>
              <span className="prayer-calendar-row-name">{prayerNames[row.name][ar ? "ar" : "en"]}</span>
              <strong dir="ltr">{new Intl.DateTimeFormat(ar ? "ar" : "en", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: timezone }).format(row.at)}</strong>
              {row.isNext && <span className="prayer-calendar-up-next">{ar ? "القادمة" : "NEXT"}</span>}
            </div>
          ))}
          {!today && <p className="prayer-calendar-empty">{ar ? "أضف موقعك لحساب المواقيت" : "Set your location to calculate prayer times."}</p>}
        </section>
        <footer className="prayer-calendar-footer">
          <span>{ar ? "أوقات الصلاة حسب موقعك وطريقة الحساب المحددة" : "Calculated for your location and selected method"}</span>
        </footer>
      </section>
    </main>
  );
}
