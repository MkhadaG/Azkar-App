import { useEffect, useMemo, useState } from "react";
import { getAllWebviewWindows } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { AppState } from "../app/model";
import type { PrayerSchedule } from "../services/prayer";
import { nextPrayer, prayerNames } from "../services/prayer";
import { Icon } from "./Icon";
import brandIcon from "../assets/azkar-icon.png";

interface Props { state: AppState; schedules: PrayerSchedule[]; now: Date; }

function formatCountdown(ms: number, ar: boolean): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const values = [hours, minutes, seconds].map((value) => String(value).padStart(2, "0"));
  return ar ? values.join(" : ") : values.join(" : ");
}

export function TrayPopup({ state, schedules, now }: Props) {
  const ar = state.preferences.language === "ar";
  const upcoming = useMemo(() => nextPrayer(schedules, now), [schedules, now]);
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = upcoming ? upcoming.at.getTime() - tick : 0;
  const prayerName = upcoming ? prayerNames[upcoming.name][ar ? "ar" : "en"] : (ar ? "غير متاح" : "Unavailable");
  const prayerTime = upcoming ? new Intl.DateTimeFormat(ar ? "ar" : "en", { hour: "numeric", minute: "2-digit", timeZone: state.preferences.location?.timezone }).format(upcoming.at) : "—";
  const location = state.preferences.location;
  const date = new Intl.DateTimeFormat(ar ? "ar" : "en", { weekday: "long", day: "numeric", month: "long", timeZone: location?.timezone }).format(now);

  async function openApp() {
    const windows = await getAllWebviewWindows();
    const main = windows.find((window) => window.label === "main");
    if (main) { await main.show(); await main.setFocus(); }
    await getCurrentWindow().hide();
  }

  return <main className={`tray-root ${ar ? "tray-ar" : "tray-en"}`}>
    <div className="tray-glass">
      <div className="tray-glow" />
      <header className="tray-header">
        <div className="tray-brand"><img src={brandIcon} alt="" /><div><strong>أذكار</strong><span>AZKAR COMPANION</span></div></div>
        <button className="tray-close" onClick={() => getCurrentWindow().hide()} aria-label={ar ? "إغلاق" : "Close"}><Icon name="close" size={16} /></button>
      </header>
      <section className="tray-prayer">
        <div className="tray-prayer-top"><span className="tray-eyebrow">{ar ? "الصلاة القادمة" : "NEXT PRAYER"}</span><span className="tray-live"><i />{ar ? "مباشر" : "LIVE"}</span></div>
        <div className="tray-prayer-main"><div><h1>{prayerName}</h1><p>{location ? `${location.name}${location.country ? ` · ${location.country}` : ""}` : (ar ? "أضف موقعك لحساب المواقيت" : "Set your location for prayer times")}</p></div><div className="tray-prayer-time">{prayerTime}</div></div>
        <div className="tray-count-label">{ar ? "الوقت المتبقي" : "TIME REMAINING"}</div>
        <div className="tray-countdown" dir="ltr">{upcoming ? formatCountdown(remaining, ar) : "-- : -- : --"}<span>{ar ? "ساعة  ·  دقيقة  ·  ثانية" : "HOURS  ·  MINUTES  ·  SECONDS"}</span></div>
        <div className="tray-progress"><span style={{ width: `${upcoming ? Math.max(3, Math.min(100, 100 - remaining / (5 * 60 * 60 * 1000) * 100)) : 0}%` }} /></div>
      </section>
      <div className="tray-meta"><div className="tray-meta-icon"><Icon name="calendar" size={17} /></div><div><strong>{date}</strong><span>{location?.timezone ?? (ar ? "المنطقة الزمنية غير محددة" : "Timezone not set")}</span></div></div>
      <button className="tray-open" onClick={openApp}><span>{ar ? "فتح أذكار" : "Open Azkar"}</span><Icon name="arrow" size={17} /></button>
      <footer className="tray-footer"><span>{ar ? "رفيقك اليومي للعبادة" : "Your quiet daily companion"}</span><span>AZKAR</span></footer>
    </div>
  </main>;
}
