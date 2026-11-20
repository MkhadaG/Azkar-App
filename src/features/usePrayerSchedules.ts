import { useCallback, useMemo, useState } from "react";
import type { Location, PrayerAdjustments } from "../app/model";
import { calculateSchedules, type PrayerSchedule } from "../services/prayer";

/** Prayer times are calculated on the device, so this is synchronous and works offline. */
export function usePrayerSchedules(location: Location | null, method: number, adjustments: PrayerAdjustments) {
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const schedules: PrayerSchedule[] = useMemo(
    () => (location ? calculateSchedules(location, method, adjustments, new Date()) : []),
    [location, method, adjustments, revision],
  );
  return { schedules, loading: false, error: "", refresh };
}
