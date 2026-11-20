export type Language = "ar" | "en";
export type Theme = "light" | "dark";
export type NavSection =
  | "home"
  | "prayer"
  | "quran"
  | "azkar"
  | "reminders"
  | "tasbih"
  | "calendar"
  | "settings";

export interface Location {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface Preferences {
  language: Language;
  theme: Theme;
  location: Location | null;
  calculationMethod: number;
  notificationsEnabled: boolean;
  prayerReminders: Record<string, boolean>;
}

export interface AppState {
  hasCompletedOnboarding: boolean;
  preferences: Preferences;
  tasbihCount: number;
  tasbihLabel: string;
  tasbihGoalEnabled: boolean;
  tasbihGoal: number;
  adhkarCounts: Record<string, number>;
  quranSurah: number;
  quranAyah: number;
  quranPage: number | null;
  quranBookmarks: string[];
}

export const initialState: AppState = {
  hasCompletedOnboarding: false,
  preferences: {
    language: "ar",
    theme: "dark",
    location: null,
    calculationMethod: 3,
    notificationsEnabled: false,
    prayerReminders: {
      Fajr: false,
      Dhuhr: false,
      Asr: false,
      Maghrib: false,
      Isha: false,
    },
  },
  tasbihCount: 0,
  tasbihLabel: "سُبْحَانَ اللَّهِ",
  tasbihGoalEnabled: false,
  tasbihGoal: 33,
  adhkarCounts: {},
  quranSurah: 1,
  quranAyah: 1,
  quranPage: null,
  quranBookmarks: [],
};

export const calculationMethods = [
  { id: 1, ar: "باكستان", en: "Pakistan" },
  { id: 2, ar: "أمريكا الشمالية", en: "North America" },
  { id: 3, ar: "عام", en: "General" },
  { id: 4, ar: "السعودية", en: "Saudi Arabia" },
  { id: 5, ar: "مصر", en: "Egypt" },
  { id: 7, ar: "إيران", en: "Iran" },
  { id: 8, ar: "الإمارات", en: "United Arab Emirates" },
  { id: 9, ar: "الكويت", en: "Kuwait" },
  { id: 10, ar: "قطر", en: "Qatar" },
  { id: 11, ar: "سنغافورة", en: "Singapore" },
  { id: 13, ar: "تركيا", en: "Turkey" },
] as const;
