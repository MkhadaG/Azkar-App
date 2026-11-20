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

export interface PrayerAdjustments {
  Fajr: number;
  Dhuhr: number;
  Asr: number;
  Maghrib: number;
  Isha: number;
}

export interface Preferences {
  language: Language;
  theme: Theme;
  location: Location | null;
  calculationMethod: number;
  notificationsEnabled: boolean;
  prayerReminders: Record<string, boolean>;
  prayerAdjustments: PrayerAdjustments;
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
    prayerAdjustments: { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 },
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
  { id: 1, ar: "جامعة العلوم الإسلامية — كراتشي", en: "University of Islamic Sciences, Karachi" },
  { id: 2, ar: "الجمعية الإسلامية لأمريكا الشمالية", en: "ISNA" },
  { id: 3, ar: "رابطة العالم الإسلامي", en: "Muslim World League" },
  { id: 4, ar: "أم القرى — مكة المكرمة", en: "Umm al-Qura, Makkah" },
  { id: 5, ar: "الهيئة المصرية العامة للمساحة", en: "Egyptian General Authority of Survey" },
  { id: 7, ar: "معهد الجيوفيزياء — جامعة طهران", en: "Institute of Geophysics, University of Tehran" },
  { id: 8, ar: "منطقة الخليج", en: "Gulf Region" },
  { id: 9, ar: "الكويت", en: "Kuwait" },
  { id: 10, ar: "قطر", en: "Qatar" },
  { id: 11, ar: "مجلس سنغافورة الإسلامي", en: "Majlis Ugama Islam Singapura" },
  { id: 13, ar: "ديانت — تركيا", en: "Diyanet, Turkey" },
] as const;
