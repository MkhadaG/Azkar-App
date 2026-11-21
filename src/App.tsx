import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { copy, navigation, sectionTitles } from "./app/locale";
import { initialState, type AppState, type NavSection } from "./app/model";
import { loadAppState, saveAppState } from "./app/storage";
import { notify } from "./app/desktop";
import { prayerNames, upcomingPrayerReminders } from "./services/prayer";
import { usePrayerSchedules } from "./features/usePrayerSchedules";
import { FeatureView } from "./features/FeatureView";
import { Icon, type IconName } from "./components/Icon";
import { Onboarding } from "./components/Onboarding";
import { TitleBar } from "./components/TitleBar";
import { TrayPopup } from "./components/TrayPopup";
import { TaskbarPrayerWidget } from "./components/TaskbarPrayerWidget";
import brandIcon from "./assets/azkar-icon.png";
import "./styles.css";

const sectionIcons: Record<NavSection, IconName> = {
  home: "home",
  prayer: "moon",
  quran: "book",
  azkar: "sun",
  reminders: "bell",
  tasbih: "tasbih",
  calendar: "calendar",
  settings: "settings",
};

const REMINDER_CHECK_MS = 1_000;
const REMINDER_GRACE_MS = 90_000;

function messageOf(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

function dateKeyInTimezone(timezone: string, date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function App() {
  const isTrayWindow = new URLSearchParams(window.location.search).has("tray");
  const isTaskbarWidgetWindow = new URLSearchParams(window.location.search).has("widget");
  const [state, setState] = useState<AppState>(initialState);
  const [section, setSection] = useState<NavSection>("home");
  const [editingLocation, setEditingLocation] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const dayRef = useRef("");

  const prefs = state.preferences;
  const language = prefs.language;
  const text = copy[language];
  const timezone = prefs.location?.timezone;
  const {
    schedules,
    loading,
    error: prayerError,
    refresh,
  } = usePrayerSchedules(prefs.location, prefs.calculationMethod);

  useEffect(() => {
    let active = true;
    loadAppState()
      .then((saved) => {
        if (active) setState(saved);
      })
      .catch((reason: unknown) => {
        if (active) setLoadError(messageOf(reason, "Could not load saved Azkar data."));
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Debounced save: a burst of taps becomes one write.
  useEffect(() => {
    if (!ready || loadError || isTrayWindow || isTaskbarWidgetWindow) return;
    const timer = window.setTimeout(() => {
      saveAppState(state)
        .then(() => setSaveError(""))
        .catch((reason: unknown) => setSaveError(messageOf(reason, "Could not save your changes.")));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [state, ready, loadError, isTrayWindow, isTaskbarWidgetWindow]);

  // Keep the optional taskbar widget alive when enabled, including after a restart.
  useEffect(() => {
    if (!ready || !isTauri() || isTrayWindow || isTaskbarWidgetWindow) return;
    void invoke("set_taskbar_widget", {
      enabled: prefs.taskbarWidgetEnabled,
      clickThrough: prefs.taskbarWidgetClickThrough,
      size: prefs.taskbarWidgetSize,
    }).catch((reason) => {
      console.error("Could not sync the Azkar taskbar widget.", reason);
    });
  }, [ready, prefs.taskbarWidgetEnabled, prefs.taskbarWidgetClickThrough, prefs.taskbarWidgetSize, isTrayWindow, isTaskbarWidgetWindow]);

  // The widget uses its own WebView, so periodically refresh its saved app state
  // after the main window changes the city, language, or calculation method.
  useEffect(() => {
    if (!ready || !isTaskbarWidgetWindow) return;
    const timer = window.setInterval(() => {
      void loadAppState().then((saved) => {
        setState((current) => JSON.stringify(current) === JSON.stringify(saved) ? current : saved);
      }).catch((reason) => console.error("Could not refresh the taskbar prayer widget.", reason));
    }, 4000);
    return () => window.clearInterval(timer);
  }, [ready, isTaskbarWidgetWindow]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!timezone) {
      dayRef.current = "";
      return;
    }
    dayRef.current = dateKeyInTimezone(timezone, new Date());
    const timer = window.setInterval(() => {
      const key = dateKeyInTimezone(timezone, new Date());
      if (key !== dayRef.current) {
        dayRef.current = key;
        refresh();
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [timezone, refresh]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.dataset.theme = prefs.theme;
  }, [language, prefs.theme]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [section]);



  // Prayer reminders: checked every second while the app runs (including hidden in the tray).
  const reminderSource = useRef({ schedules, prefs });
  useEffect(() => {
    reminderSource.current = { schedules, prefs };
  }, [schedules, prefs]);

  useEffect(() => {
    // Only the hidden/main application window owns reminders. Tray and widget
    // WebViews must never send duplicate native notifications.
    if (!ready || isTrayWindow || isTaskbarWidgetWindow) return;
    const fired = new Set<string>();
    const timer = window.setInterval(() => {
      const latest = reminderSource.current;
      if (!latest.prefs.notificationsEnabled || !latest.prefs.location) return;
      const current = Date.now();
      const due = upcomingPrayerReminders(
        latest.schedules,
        latest.prefs.prayerReminders,
        new Date(current - REMINDER_GRACE_MS),
      );
      for (const reminder of due) {
        if (reminder.at.getTime() > current || fired.has(reminder.id)) continue;
        fired.add(reminder.id);
        const ar = latest.prefs.language === "ar";
        void notify(
          ar ? "حان وقت الصلاة" : "Prayer time",
          ar ? `حان وقت صلاة ${prayerNames[reminder.name].ar}` : `It's time for ${prayerNames[reminder.name].en}.`,
        ).catch((reason) => console.error("Could not send the Azkar prayer reminder.", reason));
      }
    }, REMINDER_CHECK_MS);
    return () => window.clearInterval(timer);
  }, [ready, isTrayWindow, isTaskbarWidgetWindow]);

  function toggleTheme() {
    setState((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        theme: current.preferences.theme === "light" ? "dark" : "light",
      },
    }));
  }

  if (!ready) {
    if (isTaskbarWidgetWindow) {
      return <main className="taskbar-widget-root" aria-busy="true"><div className="taskbar-widget-loading" /></main>;
    }
    if (isTrayWindow) {
      return <main className="tray-root" aria-busy="true"><div className="tray-panel tray-panel-loading" /></main>;
    }
    return (
      <div className="app">
        <TitleBar language={language} timezone={timezone} />
        <div className="boot" aria-busy="true" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="app">
        <TitleBar language={language} timezone={timezone} />
        <main className="fatal">
          <Icon name="moon" size={30} />
          <h1>Azkar</h1>
          <p>{loadError}</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            {text.retry}
          </button>
        </main>
      </div>
    );
  }

  if (isTrayWindow) {
    return <TrayPopup state={state} schedules={schedules} now={now} />;
  }

  if (isTaskbarWidgetWindow) {
    return <TaskbarPrayerWidget state={state} schedules={schedules} />;
  }

  if (!state.hasCompletedOnboarding) {
    return (
      <div className="app">
        <TitleBar language={language} timezone={timezone} />
        <Onboarding
          preferences={prefs}
          onThemePreview={(theme) =>
            setState((current) => ({ ...current, preferences: { ...current.preferences, theme } }))}
          onComplete={(next) => {
            setState((current) => ({ ...current, hasCompletedOnboarding: true, preferences: next }));
          }}
        />
      </div>
    );
  }

  const ar = language === "ar";
  const menu = navigation[language];

  return (
    <div className="app">
      <TitleBar language={language} timezone={timezone} />
      <div className="shell">
        <aside className="sidebar">
          <button
            type="button"
            className="brand"
            onClick={() => setSection("home")}
            aria-label={ar ? "الصفحة الرئيسية" : "Home"}
          >
            <img src={brandIcon} alt="" className="brand-mark" width={28} height={28} />
            <span className="brand-name" lang="ar">أذكار</span>
          </button>

          <nav className="nav" aria-label={ar ? "التنقل" : "Navigation"}>
            {menu.map((item) => (
              <button
                type="button"
                key={item.section}
                className={`nav-item${section === item.section ? " is-active" : ""}`}
                onClick={() => setSection(item.section)}
                aria-current={section === item.section ? "page" : undefined}
                title={item.label}
              >
                <Icon name={sectionIcons[item.section]} size={20} />
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-foot">
            <button
              type="button"
              className={`nav-item${section === "settings" ? " is-active" : ""}`}
              onClick={() => setSection("settings")}
              aria-current={section === "settings" ? "page" : undefined}
              title={text.settings}
            >
              <Icon name="settings" size={20} />
              <span className="nav-label">{text.settings}</span>
            </button>
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <div className="topbar-title">
              <h1>{sectionTitles[language][section]}</h1>
            </div>
            <div className="topbar-actions">
              {prefs.location && (
                <button type="button" className="chip" onClick={() => setSection("settings")}>
                  <Icon name="pin" size={15} />
                  <span>{prefs.location.name}</span>
                </button>
              )}
              <button
                type="button"
                className="chip"
                onClick={toggleTheme}
                aria-label={prefs.theme === "light" ? text.dark : text.light}
              >
                <Icon name={prefs.theme === "light" ? "moon" : "sun"} size={15} />
                <span>{prefs.theme === "light" ? text.dark : text.light}</span>
              </button>
            </div>
          </header>

          {saveError && (
            <div className="notice notice-error notice-banner" role="alert">
              <span>{saveError}</span>
            </div>
          )}

          <div className="scroll" ref={scrollRef}>
            <FeatureView
              section={section}
              state={state}
              text={text}
              onNavigate={setSection}
              onChange={setState}
              schedules={schedules}
              loading={loading}
              error={prayerError}
              refresh={refresh}
              onEditLocation={() => setEditingLocation(true)}
            />
          </div>
        </main>
      </div>
      {editingLocation && (
        <div className="location-overlay">
          <div className="location-dialog" role="dialog" aria-modal="true" aria-label={ar ? "تغيير الموقع" : "Change location"}>
            <Onboarding
              preferences={prefs}
              mode="location"
              onThemePreview={(theme) =>
                setState((current) => ({ ...current, preferences: { ...current.preferences, theme } }))}
              onComplete={(next) => {
                setState((current) => ({ ...current, hasCompletedOnboarding: true, preferences: next }));
                setEditingLocation(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
