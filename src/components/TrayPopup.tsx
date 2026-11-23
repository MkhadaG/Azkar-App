import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppState } from "../app/model";
import type { PrayerSchedule } from "../services/prayer";
import { nextPrayer, prayerNames, toZonedInstant, type PrayerName } from "../services/prayer";
import { Icon } from "./Icon";

interface Props { state: AppState; schedules: PrayerSchedule[]; now: Date; }

const prayerOrder: PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(" : ");
}

export function TrayPopup({ state, schedules, now }: Props) {
  const ar = state.preferences.language === "ar";
  const location = state.preferences.location;
  const [tick, setTick] = useState(() => Date.now());
  const [animationKey, setAnimationKey] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    const replayEntrance = () => setAnimationKey((value) => value + 1);
    window.addEventListener("azkar-tray-open", replayEntrance);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("azkar-tray-open", replayEntrance);
    };
  }, []);

  const currentTime = new Date(tick);
  const upcoming = useMemo(() => nextPrayer(schedules, currentTime), [schedules, tick]);
  const today = schedules[0];
  const prayerTime = upcoming
    ? new Intl.DateTimeFormat(ar ? "ar" : "en", {
        hour: "numeric", minute: "2-digit", hour12: true, timeZone: location?.timezone,
      }).format(upcoming.at)
    : "—";
  const date = new Intl.DateTimeFormat(ar ? "ar" : "en", {
    weekday: "long", day: "numeric", month: "long", timeZone: location?.timezone,
  }).format(now);
  const remaining = upcoming ? upcoming.at.getTime() - tick : 0;

  const progress = useMemo(() => {
    if (!upcoming) return 0;
    const ordered = schedules.flatMap((schedule) =>
      prayerOrder.map((name) => toZonedInstant(schedule.date, schedule.timings[name], schedule.timezone)),
    ).sort((a, b) => a.getTime() - b.getTime());
    const passed = ordered.filter((at) => at.getTime() <= tick);
    const previous = passed[passed.length - 1];
    if (!previous) return 0;
    const span = upcoming.at.getTime() - previous.getTime();
    return span > 0 ? Math.max(0, Math.min(100, ((tick - previous.getTime()) / span) * 100)) : 0;
  }, [schedules, upcoming, tick]);

  async function openApp() {
    await invoke("open_main_window");
  }

  async function closePopup() {
    await invoke("hide_tray_popup");
  }

  return (
    <main className={`tray-root ${ar ? "tray-ar" : "tray-en"}`}>
      <div className="tray-panel" key={animationKey}>
        <header className="tray-header">
          <div className="tray-date" dir={ar ? "rtl" : "ltr"}>{date}</div>
          <button className="tray-close" onClick={() => void closePopup()} aria-label={ar ? "إغلاق" : "Close"}>
            <Icon name="close" size={16} />
          </button>
        </header>

        <section className="tray-focus">
          <div className="tray-focus-label">
            <span>{ar ? "الصلاة القادمة" : "NEXT PRAYER"}</span>
            <span className="tray-status"><i />{ar ? "الموعد القادم" : "UPCOMING"}</span>
          </div>
          <div className="tray-focus-row">
            <div className="tray-prayer-name">
              <h1>{upcoming ? prayerNames[upcoming.name][ar ? "ar" : "en"] : (ar ? "غير متاح" : "Unavailable")}</h1>
              <p>{location ? `${location.name}${location.country ? ` · ${location.country}` : ""}` : (ar ? "اختر موقعك لعرض المواقيت" : "Choose a location to see prayer times")}</p>
            </div>
            <div className="tray-prayer-at"><strong>{prayerTime}</strong><span>{ar ? "وقت الصلاة" : "PRAYER TIME"}</span></div>
          </div>
          <div className="tray-count-row">
            <span>{ar ? "الوقت المتبقي" : "TIME REMAINING"}</span>
            <strong dir="ltr">{upcoming ? formatCountdown(remaining) : "-- : -- : --"}</strong>
          </div>
          <div className="tray-progress"><span style={{ width: `${progress}%` }} /></div>
        </section>

        <section className="tray-schedule">
          <div className="tray-schedule-head">
            <strong>{ar ? "مواقيت اليوم" : "TODAY'S PRAYERS"}</strong>
            <span>{location?.timezone ?? (ar ? "المنطقة الزمنية غير محددة" : "Timezone not set")}</span>
          </div>
          <div className="tray-times">
            {today && prayerOrder.map((name) => {
              const isNext = upcoming?.name === name && upcoming.at.getTime() === toZonedInstant(today.date, today.timings[name], today.timezone).getTime();
              return (
                <div className={`tray-time${isNext ? " is-next" : ""}`} key={name}>
                  <span>{prayerNames[name][ar ? "ar" : "en"]}</span>
                  <strong dir="ltr">{new Intl.DateTimeFormat(ar ? "ar" : "en", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: today.timezone }).format(toZonedInstant(today.date, today.timings[name], today.timezone))}</strong>
                </div>
              );
            })}
            {!today && <p className="tray-no-times">{ar ? "أضف موقعك لحساب المواقيت" : "Set your location to calculate prayer times"}</p>}
          </div>
        </section>

        <footer className="tray-footer">
          <span>{ar ? "رفيقك اليومي للعبادة" : "Your daily prayer companion"}</span>
          <button className="tray-quit" onClick={() => void invoke("quit_app")}>
            {ar ? "خروج" : "Exit"}
          </button>
          <button className="tray-open" onClick={openApp}>
            {ar ? "فتح التطبيق" : "Open app"}<Icon name="arrow" flip size={16} />
          </button>
        </footer>
      </div>
    </main>
  );
}
