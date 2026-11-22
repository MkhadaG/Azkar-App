import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppState } from "../app/model";
import type { PrayerSchedule, PrayerName } from "../services/prayer";
import { prayerNames, toZonedInstant } from "../services/prayer";

interface Props {
  state: AppState;
  schedules: PrayerSchedule[];
}

const prayerOrder: Exclude<PrayerName, "Sunrise">[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

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
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true,
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  // Keep the child HWND attached to Shell_TrayWnd if Explorer refreshes its taskbar.
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

  const timeline = useMemo(() => schedules
    .flatMap((schedule) => prayerOrder.map((name) => ({
      name,
      at: toZonedInstant(schedule.date, schedule.timings[name], schedule.timezone),
    })))
    .sort((a, b) => a.at.getTime() - b.at.getTime()), [schedules]);

  const nextIndex = timeline.findIndex((prayer) => prayer.at.getTime() > now.getTime());
  const upcoming = nextIndex >= 0 ? timeline[nextIndex] : null;
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
  const label = upcoming
    ? `${prayerLabel}، ${prayerTime}، ${ar ? "متبقي" : "in"} ${countdown(remaining)}`
    : (ar ? "اختر موقعك لعرض مواقيت الصلاة" : "Set your location to see prayer times");

  async function openPrayerCalendar() {
    if (state.preferences.taskbarWidgetClickThrough) return;
    try {
      await invoke("toggle_prayer_calendar", { theme: state.preferences.theme });
    } catch (reason) {
      console.error("Could not open the Azkar prayer timetable.", reason);
    }
  }

  return (
    <main
      className={`taskbar-widget-root ${systemDark ? "is-system-dark" : "is-system-light"}${state.preferences.taskbarWidgetClickThrough ? " is-click-through" : ""}`}
      dir={ar ? "rtl" : "ltr"}
      aria-label={ar ? "مواقيت الصلاة" : "Prayer times"}
      title={label}
    >
      <button
        type="button"
        className={`taskbar-widget-button is-${state.preferences.taskbarWidgetSize}`}
        onClick={() => void openPrayerCalendar()}
        disabled={state.preferences.taskbarWidgetClickThrough}
        aria-label={ar ? "فتح مواقيت الصلاة القادمة" : "Open upcoming prayer times"}
      >
        <span className="taskbar-widget-prayer">{prayerLabel}</span>
        <span className="taskbar-widget-time">{prayerTime}</span>
        <span className="taskbar-widget-divider" aria-hidden="true" />
        <time className="taskbar-widget-countdown" dir="ltr">{upcoming ? countdown(remaining) : "--:--:--"}</time>
      </button>
    </main>
  );
}
