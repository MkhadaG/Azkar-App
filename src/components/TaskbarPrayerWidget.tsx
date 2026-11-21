import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppState } from "../app/model";
import type { PrayerSchedule } from "../services/prayer";
import { nextPrayer, prayerNames } from "../services/prayer";

interface Props {
  state: AppState;
  schedules: PrayerSchedule[];
}

function countdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export function TaskbarPrayerWidget({ state, schedules }: Props) {
  const ar = state.preferences.language === "ar";
  const location = state.preferences.location;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const upcoming = useMemo(() => nextPrayer(schedules, now), [schedules, now]);
  const remaining = upcoming ? upcoming.at.getTime() - now.getTime() : 0;
  const prayerTime = upcoming
    ? new Intl.DateTimeFormat(ar ? "ar" : "en", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: location?.timezone,
      }).format(upcoming.at)
    : "—";
  const prayerLabel = upcoming
    ? prayerNames[upcoming.name][ar ? "ar" : "en"]
    : ar ? "اختر موقعك" : "Choose your location";

  return (
    <main className="taskbar-widget-root">
      <button
        type="button"
        className="taskbar-widget-card"
        onClick={() => void invoke("open_main_window")}
        aria-label={ar ? "فتح أذكار ومواقيت الصلاة" : "Open Azkar prayer times"}
      >
        <span className="taskbar-widget-accent" />
        <div className="taskbar-widget-content">
          <div className="taskbar-widget-copy">
            <span className="taskbar-widget-eyebrow">{ar ? "الصلاة القادمة" : "NEXT PRAYER"}</span>
            <strong className="taskbar-widget-prayer" dir={ar ? "rtl" : "ltr"}>{prayerLabel}</strong>
            <span className="taskbar-widget-location">{location?.name ?? (ar ? "أضف موقعك لعرض المواقيت" : "Add a location to see prayer times")}</span>
          </div>
          <div className="taskbar-widget-clock" dir="ltr">
            <strong>{prayerTime}</strong>
            <span>{upcoming ? countdown(remaining) : "--:--:--"}</span>
          </div>
        </div>
        <span className="taskbar-widget-bottom-line" />
      </button>
    </main>
  );
}
