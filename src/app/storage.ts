import { initialState, type AppState, type Location } from "./model";

const storageKey = "azkar.app-state.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLocation(value: unknown): value is Location | null {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return (
    typeof value.name === "string" &&
    typeof value.country === "string" &&
    typeof value.latitude === "number" &&
    typeof value.longitude === "number" &&
    typeof value.timezone === "string"
  );
}

function parseState(value: string | null): AppState {
  if (!value) return initialState;
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed) || !isRecord(parsed.preferences)) {
    throw new Error("Saved Azkar data is invalid.");
  }
  const savedPreferences = parsed.preferences;
  // Preferences may have been written by an older app version. Recover each
  // field independently so one outdated value cannot prevent the app opening.
  const savedLocation = isLocation(savedPreferences.location)
    ? savedPreferences.location
    : initialState.preferences.location;
  const savedLanguage = savedPreferences.language === "ar" || savedPreferences.language === "en"
    ? savedPreferences.language
    : initialState.preferences.language;
  const savedTheme = savedPreferences.theme === "light" || savedPreferences.theme === "dark"
    ? savedPreferences.theme
    : initialState.preferences.theme;
  const savedCalculationMethod = typeof savedPreferences.calculationMethod === "number" &&
      Number.isFinite(savedPreferences.calculationMethod)
    ? savedPreferences.calculationMethod
    : initialState.preferences.calculationMethod;

  const counts: Record<string, number> = {};
  if (parsed.adhkarCounts !== undefined) {
    if (!isRecord(parsed.adhkarCounts)) throw new Error("Saved adhkar progress is invalid.");
    for (const [key, count] of Object.entries(parsed.adhkarCounts)) {
      if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
        throw new Error("Saved adhkar progress is invalid.");
      }
      counts[key] = count;
    }
  }

  const reminders = { ...initialState.preferences.prayerReminders };
  if (savedPreferences.prayerReminders !== undefined) {
    if (!isRecord(savedPreferences.prayerReminders)) throw new Error("Saved reminder preferences are invalid.");
    for (const [key, enabled] of Object.entries(savedPreferences.prayerReminders)) {
      if (typeof enabled !== "boolean") throw new Error("Saved reminder preferences are invalid.");
      reminders[key] = enabled;
    }
  }
  const notificationsEnabled = typeof savedPreferences.notificationsEnabled === "boolean"
    ? savedPreferences.notificationsEnabled
    : initialState.preferences.notificationsEnabled;
  const taskbarWidgetClickThrough = typeof savedPreferences.taskbarWidgetClickThrough === "boolean"
    ? savedPreferences.taskbarWidgetClickThrough
    : initialState.preferences.taskbarWidgetClickThrough;
  const taskbarWidgetSize = savedPreferences.taskbarWidgetSize === "compact" ||
      savedPreferences.taskbarWidgetSize === "standard" ||
      savedPreferences.taskbarWidgetSize === "large"
    ? savedPreferences.taskbarWidgetSize
    : initialState.preferences.taskbarWidgetSize;
  const hasReminderCustomizationFlag = typeof savedPreferences.prayerRemindersCustomized === "boolean";
  const prayerRemindersCustomized = hasReminderCustomizationFlag
    ? savedPreferences.prayerRemindersCustomized as boolean
    : false;
  // One-time migration for versions that had no master-toggle default. If
  // notifications were already enabled, turn on all five prayer reminders once.
  if (!hasReminderCustomizationFlag && notificationsEnabled) {
    Object.assign(reminders, { Fajr: true, Dhuhr: true, Asr: true, Maghrib: true, Isha: true });
  }
  const bookmarks = parsed.quranBookmarks ?? initialState.quranBookmarks;
  if (!Array.isArray(bookmarks) || !bookmarks.every((item) => typeof item === "string")) {
    throw new Error("Saved Quran bookmarks are invalid.");
  }
  const tasbihGoalEnabled = parsed.tasbihGoalEnabled ?? initialState.tasbihGoalEnabled;
  const tasbihGoal = parsed.tasbihGoal ?? initialState.tasbihGoal;
  if (
    typeof tasbihGoalEnabled !== "boolean" ||
    typeof tasbihGoal !== "number" ||
    !Number.isSafeInteger(tasbihGoal) ||
    tasbihGoal < 1
  ) {
    throw new Error("Saved tasbih goal is invalid.");
  }

  return {
    hasCompletedOnboarding: typeof parsed.hasCompletedOnboarding === "boolean"
      ? parsed.hasCompletedOnboarding
      : initialState.hasCompletedOnboarding,
    preferences: {
      ...initialState.preferences,
      language: savedLanguage,
      theme: savedTheme,
      location: savedLocation,
      calculationMethod: savedCalculationMethod,
      notificationsEnabled,
      prayerReminders: reminders,
      prayerRemindersCustomized,
      taskbarWidgetEnabled: typeof savedPreferences.taskbarWidgetEnabled === "boolean"
        ? savedPreferences.taskbarWidgetEnabled
        : initialState.preferences.taskbarWidgetEnabled,
      taskbarWidgetClickThrough,
      taskbarWidgetSize,
    },
    tasbihCount: typeof parsed.tasbihCount === "number" && Number.isInteger(parsed.tasbihCount) && parsed.tasbihCount >= 0
      ? parsed.tasbihCount
      : initialState.tasbihCount,
    tasbihLabel: typeof parsed.tasbihLabel === "string" ? parsed.tasbihLabel : initialState.tasbihLabel,
    tasbihGoalEnabled,
    tasbihGoal,
    adhkarCounts: counts,
    quranSurah: typeof parsed.quranSurah === "number" && Number.isInteger(parsed.quranSurah) && parsed.quranSurah >= 1 && parsed.quranSurah <= 114
      ? parsed.quranSurah
      : initialState.quranSurah,
    quranAyah: typeof parsed.quranAyah === "number" && Number.isInteger(parsed.quranAyah) && parsed.quranAyah > 0
      ? parsed.quranAyah
      : initialState.quranAyah,
    quranPage: typeof parsed.quranPage === "number" && Number.isInteger(parsed.quranPage) && parsed.quranPage >= 1 && parsed.quranPage <= 604
      ? parsed.quranPage
      : initialState.quranPage,
    quranBookmarks: bookmarks,
  };
}

export async function loadAppState(): Promise<AppState> {
  return parseState(window.localStorage.getItem(storageKey));
}

export async function saveAppState(state: AppState): Promise<void> {
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}
