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

  // Reposition with the shell if the notification area moves or the taskbar
  // changes size. This is intentionally not a draggable floating window.
  useEffect(() => {
    let errorReported = false;
    const alignWithTaskbar = () => {
      void invoke("reposition_taskbar_widget", {
        clickThrough: state.preferences.taskbarWidgetClickThrough,
      }).then(() => {
        errorReported = false;
      }).catch((reason) => {
        if (!errorReported) {
          console.error("Could not align the prayer indicator with the Windows taskbar.", reason);
          errorReported = true;
        }
      });
    };
    alignWithTaskbar();
    const timer = window.setInterval(alignWithTaskbar, 2500);
    return () => window.clearInterval(timer);
  }, [state.preferences.taskbarWidgetClickThrough]);

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
    : ar ? "اختر الموقع" : "Set location";

  return (
    <main
      className={`taskbar-widget-root ${state.preferences.theme === "light" ? "is-light" : "is-dark"}${state.preferences.taskbarWidgetClickThrough ? " is-click-through" : ""}`}
      dir={ar ? "rtl" : "ltr"}
      aria-label={ar ? "مواقيت الصلاة" : "Prayer times"}
    >
      <div className={`taskbar-widget-card is-${state.preferences.taskbarWidgetSize}`}>
        <span className="taskbar-widget-accent" aria-hidden="true" />
        <span className="taskbar-widget-dot" aria-hidden="true" />
        <div className="taskbar-widget-prayer-group">
          <span className="taskbar-widget-eyebrow">{ar ? "القادمة" : "NEXT"}</span>
          <strong className="taskbar-widget-prayer">{prayerLabel}</strong>
          <span className="taskbar-widget-time">{prayerTime}</span>
        </div>
        <span className="taskbar-widget-divider" aria-hidden="true" />
        <time className="taskbar-widget-countdown" dir="ltr">{upcoming ? countdown(remaining) : "--:--:--"}</time>
      </div>
    </main>
  );
}
