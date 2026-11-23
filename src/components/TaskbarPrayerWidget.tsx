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
  const [taskbarMode, setTaskbarMode] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Windows' taskbar theme is separate from the app theme. The native command
  // reads SystemUsesLightTheme and, when enabled, the actual taskbar accent color.
  useEffect(() => {
    let active = true;
    const refreshMode = () => {
      void invoke<string>("get_taskbar_text_mode").then((mode) => {
        if (active && (mode === "dark" || mode === "light")) setTaskbarMode(mode);
      }).catch((reason) => console.warn("Could not detect the Windows taskbar color mode.", reason));
    };
    refreshMode();
    const timer = window.setInterval(refreshMode, 1800);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  // Keep the child HWND attached if Explorer refreshes or rebuilds its taskbar.
  useEffect(() => {
    let errorReported = false;
    const alignWithTaskbar = () => {
      void invoke("reposition_taskbar_widget").then(() => {
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
  }, []);

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
        hour: "numeric", minute: "2-digit", hour12: true, timeZone: location?.timezone,
      }).format(upcoming.at)
    : "—";
  const prayerLabel = upcoming
    ? prayerNames[upcoming.name][ar ? "ar" : "en"]
    : ar ? "اختر الموقع" : "Set location";

  async function togglePrayerCalendar() {
    try {
      await invoke("toggle_prayer_calendar", { theme: state.preferences.theme });
    } catch (reason) {
      console.error("Could not toggle the Azkar prayer timetable.", reason);
    }
  }

  return (
    <main
      className={`taskbar-widget-root is-taskbar-${taskbarMode}`}
      dir={ar ? "rtl" : "ltr"}
      aria-label={ar ? "مواقيت الصلاة" : "Prayer times"}
    >
      <button
        type="button"
        className="taskbar-widget-button"
        onClick={() => void togglePrayerCalendar()}
        aria-label={ar ? "فتح أو إغلاق مواقيت الصلاة" : "Toggle prayer timetable"}
        title={ar ? "عرض مواقيت الصلاة" : "View prayer times"}
      >
        <span className="taskbar-widget-prayer">{prayerLabel}</span>
        <span className="taskbar-widget-time">{prayerTime}</span>
        <span className="taskbar-widget-divider" aria-hidden="true" />
        <time className="taskbar-widget-countdown" dir="ltr">{upcoming ? countdown(remaining) : "--:--:--"}</time>
      </button>
    </main>
  );
}
