import { CalculationMethod, Coordinates, PrayerTimes, type CalculationParameters } from "adhan";
import type { Location } from "../app/model";

export const prayerNames = {
  Fajr: { ar: "الفجر", en: "Fajr" },
  Sunrise: { ar: "الشروق", en: "Sunrise" },
  Dhuhr: { ar: "الظهر", en: "Dhuhr" },
  Asr: { ar: "العصر", en: "Asr" },
  Maghrib: { ar: "المغرب", en: "Maghrib" },
  Isha: { ar: "العشاء", en: "Isha" },
} as const;

export type PrayerName = keyof typeof prayerNames;

export interface PrayerSchedule {
  /** Calendar date (YYYY-MM-DD) in the location's timezone. */
  date: string;
  timezone: string;
  /** Times as HH:mm:ss in the location's timezone, retained to the calculated second. */
  timings: Record<PrayerName, string>;
  cached?: boolean;
}

export interface PrayerReminderOccurrence {
  id: string;
  name: Exclude<PrayerName, "Sunrise">;
  at: Date;
}

// Preference ids keep the numbers saved by earlier versions and map them to the open-source `adhan` methods.
const methodFactories: Record<number, () => CalculationParameters> = {
  1: () => CalculationMethod.Karachi(),
  2: () => CalculationMethod.NorthAmerica(),
  3: () => CalculationMethod.MuslimWorldLeague(),
  4: () => CalculationMethod.UmmAlQura(),
  5: () => CalculationMethod.Egyptian(),
  7: () => CalculationMethod.Tehran(),
  8: () => CalculationMethod.Dubai(),
  9: () => CalculationMethod.Kuwait(),
  10: () => CalculationMethod.Qatar(),
  11: () => CalculationMethod.Singapore(),
  13: () => CalculationMethod.Turkey(),
};

function dateKeyFor(timezone: string, dayOffset: number, now: Date): string {
  const date = new Date(now.getTime() + dayOffset * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Calculates one day of prayer times on the device. No internet connection is needed. */
export function calculateSchedule(
  location: Location,
  method: number,
  dayOffset = 0,
  now = new Date(),
): PrayerSchedule {
  const date = dateKeyFor(location.timezone, dayOffset, now);
  const [year, month, day] = date.split("-").map(Number);
  // Local noon on the city's calendar date, so the calculation uses the right day on any PC.
  const dayDate = new Date(year, month - 1, day, 12);
  const factory = methodFactories[method] ?? methodFactories[3];
  const times = new PrayerTimes(new Coordinates(location.latitude, location.longitude), dayDate, factory());
  const format = new Intl.DateTimeFormat("en-GB", {
    timeZone: location.timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  // Keep the full calculated second for countdowns; prayer lists can still display HH:mm.
  const clock = (instant: Date) => format.format(instant);

  return {
    date,
    timezone: location.timezone,
    timings: {
      Fajr: clock(times.fajr),
      Sunrise: clock(times.sunrise),
      Dhuhr: clock(times.dhuhr),
      Asr: clock(times.asr),
      Maghrib: clock(times.maghrib),
      Isha: clock(times.isha),
    },
  };
}

export function calculateSchedules(
  location: Location,
  method: number,
  now = new Date(),
): PrayerSchedule[] {
  return [0, 1].map((offset) => calculateSchedule(location, method, offset, now));
}

export function toZonedInstant(dateKey: string, time: string, timezone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute, second = 0] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = target;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
    const represented = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
    guess += target - represented;
  }
  return new Date(guess);
}

export function nextPrayer(
  schedules: PrayerSchedule[],
  now = new Date(),
): { name: PrayerName; at: Date } | null {
  const prayers: PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  const upcoming = schedules
    .flatMap((schedule) =>
      prayers.map((name) => ({
        name,
        at: toZonedInstant(schedule.date, schedule.timings[name], schedule.timezone),
      })),
    )
    .filter((prayer) => prayer.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  return upcoming[0] ?? null;
}

export function upcomingPrayerReminders(
  schedules: PrayerSchedule[],
  enabled: Record<string, boolean>,
  now = new Date(),
): PrayerReminderOccurrence[] {
  const prayers: Exclude<PrayerName, "Sunrise">[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  return schedules
    .flatMap((schedule) =>
      prayers
        .filter((name) => enabled[name])
        .map((name) => ({
          id: `${schedule.date}-${name}`,
          name,
          at: toZonedInstant(schedule.date, schedule.timings[name], schedule.timezone),
        })),
    )
    .filter((prayer) => prayer.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}
