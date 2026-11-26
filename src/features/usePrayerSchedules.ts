import { useCallback, useMemo, useState } from "react";
import type { Location } from "../app/model";
import { calculateSchedules, type PrayerSchedule } from "../services/prayer";

/** Prayer times are calculated locally with the Adhan astronomical library, so this works offline. */
export function usePrayerSchedules(location: Location | null, method: number) {
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const schedules: PrayerSchedule[] = useMemo(
    () => (location ? calculateSchedules(location, method, new Date()) : []),
    [location, method, revision],
  );
  return { schedules, loading: false, error: "", refresh };
}
