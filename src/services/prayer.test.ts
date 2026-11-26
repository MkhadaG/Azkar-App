import { describe, expect, it } from "vitest";
import type { Location } from "../app/model";
import { calculateSchedule, nextPrayer, toZonedInstant, upcomingPrayerReminders, type PrayerSchedule } from "./prayer";

const toMinutes = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};

describe("toZonedInstant", () => {
  it("converts local prayer times using the selected location timezone", () => {
    expect(toZonedInstant("2026-01-15", "12:00", "America/New_York").toISOString()).toBe("2026-01-15T17:00:00.000Z");
    expect(toZonedInstant("2026-07-15", "12:00", "America/New_York").toISOString()).toBe("2026-07-15T16:00:00.000Z");
    expect(toZonedInstant("2026-07-15", "12:00:37", "America/New_York").toISOString()).toBe("2026-07-15T16:00:37.000Z");
  });
});

describe("nextPrayer", () => {
  const today: PrayerSchedule = {
    date: "2026-11-15",
    timezone: "UTC",
    timings: { Fajr: "05:00", Sunrise: "06:30", Dhuhr: "12:00", Asr: "15:00", Maghrib: "18:00", Isha: "19:30" },
  };
  const tomorrow: PrayerSchedule = { ...today, date: "2026-11-16" };

  it("returns the next prayer in order", () => {
    const result = nextPrayer([today, tomorrow], new Date("2026-11-15T12:01:00Z"));
    expect(result?.name).toBe("Asr");
    expect(result?.at.toISOString()).toBe("2026-11-15T15:00:00.000Z");
  });

  it("rolls over to the next day's Fajr after Isha", () => {
    const result = nextPrayer([today, tomorrow], new Date("2026-11-15T20:00:00Z"));
    expect(result?.name).toBe("Fajr");
    expect(result?.at.toISOString()).toBe("2026-11-16T05:00:00.000Z");
  });
});

describe("upcomingPrayerReminders", () => {
  const schedule: PrayerSchedule = {
    date: "2026-11-15",
    timezone: "UTC",
    timings: { Fajr: "05:00", Sunrise: "06:30", Dhuhr: "12:00", Asr: "15:00", Maghrib: "18:00", Isha: "19:30" },
  };

  it("returns only enabled future reminders in time order", () => {
    const enabled = { Fajr: false, Dhuhr: true, Asr: true, Maghrib: false, Isha: false };
    const result = upcomingPrayerReminders([schedule], enabled, new Date("2026-11-15T11:00:00Z"));
    expect(result.map((item) => item.name)).toEqual(["Dhuhr", "Asr"]);
  });
});

describe("calculateSchedule", () => {
  const portSaid: Location = {
    name: "Port Said",
    country: "Egypt",
    latitude: 31.2565,
    longitude: 32.2841,
    timezone: "Africa/Cairo",
  };
  const now = new Date("2026-11-20T10:00:00Z");

  it("matches the Egyptian General Authority Fajr time within a minute", () => {
    const fajr = calculateSchedule(portSaid, 5, 0, now).timings.Fajr;
    expect(Math.abs(toMinutes(fajr) - toMinutes("04:51"))).toBeLessThanOrEqual(1);
  });

  it("differs from the Muslim World League method that caused the earlier 4:58 result", () => {
    const egyptian = calculateSchedule(portSaid, 5, 0, now).timings.Fajr;
    const mwl = calculateSchedule(portSaid, 3, 0, now).timings.Fajr;
    expect(toMinutes(mwl) - toMinutes(egyptian)).toBeGreaterThanOrEqual(5);
  });


  it("retains seconds for second-accurate countdowns", () => {
    const schedule = calculateSchedule(portSaid, 5, 0, now);
    expect(schedule.timings.Fajr).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("uses the city's own calendar date", () => {
    expect(calculateSchedule(portSaid, 5, 0, now).date).toBe("2026-11-20");
    expect(calculateSchedule(portSaid, 5, 1, now).date).toBe("2026-11-21");
  });
});

describe("praytimes.org calculation", () => {
  const portSaid: Location = {
    name: "Port Said",
    country: "Egypt",
    latitude: 31.2565,
    longitude: 32.2841,
    timezone: "Africa/Cairo",
  };

  it("matches the Fajr shown in the app for Port Said on 26 November", () => {
    const schedule = calculateSchedule(portSaid, 5, 0, new Date("2026-11-26T10:00:00Z"));
    expect(schedule.date).toBe("2026-11-26");
    expect(schedule.timings.Fajr).toBe("04:55:00");
  });

  it("calculates the methods the library does not include", () => {
    const kuwait = calculateSchedule(portSaid, 9, 0, new Date("2026-11-26T10:00:00Z"));
    expect(kuwait.timings.Fajr).toMatch(/^\d{2}:\d{2}:00$/);
    expect(toMinutes(kuwait.timings.Isha)).toBeGreaterThan(toMinutes(kuwait.timings.Maghrib));
  });
});
