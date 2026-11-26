import { useEffect, useMemo, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
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

// This component has no WebView of its own and renders nothing. It only feeds
// live prayer data to the native Win32 layered taskbar window.
export function TaskbarPrayerWidget({ state, schedules }: Props) {
  const desktop = isTauri();
  const ar = state.preferences.language === "ar";
  const location = state.preferences.location;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
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
  const remainingText = upcoming ? countdown(remaining) : "--:--:--";

  useEffect(() => {
    if (!desktop || !state.preferences.taskbarWidgetEnabled) return;
    void invoke("update_taskbar_widget_content", {
      prayer: prayerLabel,
      prayerKey: upcoming ? upcoming.name.toLowerCase() : "",
      prayerTime,
      countdown: remainingText,
      isArabic: ar,
      appTheme: state.preferences.theme,
    }).catch((reason) => console.error("Could not update the native Azkar taskbar indicator.", reason));
  }, [desktop, state.preferences.taskbarWidgetEnabled, state.preferences.theme, prayerLabel, prayerTime, remainingText, ar]);

  // Explorer can recreate Shell_TrayWnd (for example after a taskbar refresh).
  // Ensure the native child is reattached without creating another WebView.
  useEffect(() => {
    if (!desktop || !state.preferences.taskbarWidgetEnabled) return;
    const ensure = () => {
      void invoke("reposition_taskbar_widget").catch((reason) => {
        console.warn("Could not reattach the native Azkar taskbar indicator.", reason);
      });
    };
    ensure();
    const timer = window.setInterval(ensure, 2500);
    return () => window.clearInterval(timer);
  }, [desktop, state.preferences.taskbarWidgetEnabled]);

  return null;
}
