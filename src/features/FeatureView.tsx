import type { AppState, NavSection } from "../app/model";
import type { copy } from "../app/locale";
import type { PrayerSchedule } from "../services/prayer";
import { AzkarPage } from "./AzkarPage";
import { CalendarPage } from "./CalendarPage";
import { HomePage } from "./HomePage";
import { PrayerPage } from "./PrayerPage";
import { QuranPage } from "./QuranPage";
import { RemindersPage } from "./RemindersPage";
import { SettingsPage } from "./SettingsPage";
import { TasbihPage } from "./TasbihPage";

type Text = (typeof copy)["ar"] | (typeof copy)["en"];

export interface FeatureViewProps {
  section: NavSection;
  state: AppState;
  text: Text;
  onNavigate: (section: NavSection) => void;
  onChange: (update: (state: AppState) => AppState) => void;
  schedules: PrayerSchedule[];
  loading: boolean;
  error: string;
  refresh: () => void;
  onEditLocation: () => void;
}

export function FeatureView({ section, state, text, onNavigate, onChange, schedules, loading, error, refresh, onEditLocation }: FeatureViewProps) {
  return (
    <div className="page-enter" key={section}>
      {section === "home" && (
        <HomePage state={state} text={text} onNavigate={onNavigate} schedules={schedules} loading={loading} error={error} refresh={refresh} />
      )}
      {section === "prayer" && (
        <PrayerPage state={state} text={text} onOpenSettings={() => onNavigate("settings")} schedules={schedules} loading={loading} error={error} refresh={refresh} />
      )}
      {section === "quran" && <QuranPage state={state} text={text} onChange={onChange} />}
      {section === "azkar" && <AzkarPage state={state} onChange={onChange} />}
      {section === "reminders" && <RemindersPage state={state} onChange={onChange} />}
      {section === "tasbih" && <TasbihPage state={state} onChange={onChange} />}
      {section === "calendar" && <CalendarPage state={state} text={text} />}
      {section === "settings" && <SettingsPage state={state} text={text} onChange={onChange} onEditLocation={onEditLocation} />}
    </div>
  );
}
