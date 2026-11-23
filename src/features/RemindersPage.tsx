import { useState } from "react";
import { enabledPrayerReminders, type AppState } from "../app/model";
import { ensureNotificationPermission, isDesktop, notify, openExternal } from "../app/desktop";
import { Icon } from "../components/Icon";
import { prayerNames, type PrayerName } from "../services/prayer";

const prayers: PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

interface RemindersPageProps {
  state: AppState;
  onChange: (update: (state: AppState) => AppState) => void;
}

export function RemindersPage({ state, onChange }: RemindersPageProps) {
  const { language, notificationsEnabled, prayerReminders, location } = state.preferences;
  const ar = language === "ar";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const desktop = isDesktop();

  function setPreference(update: (preferences: AppState["preferences"]) => AppState["preferences"]) {
    onChange((current) => ({ ...current, preferences: update(current.preferences) }));
  }

  async function toggleNotifications() {
    setMessage("");
    if (notificationsEnabled) {
      setPreference((preferences) => ({ ...preferences, notificationsEnabled: false }));
      return;
    }
    if (!desktop) {
      setMessage(ar ? "التنبيهات متاحة في تطبيق سطح المكتب." : "Notifications are available in the desktop app.");
      return;
    }
    setBusy(true);
    try {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        setMessage(ar ? "لم يتم منح إذن التنبيهات." : "Notification permission was not granted.");
        return;
      }
      setPreference((preferences) => ({
        ...preferences,
        notificationsEnabled: true,
        prayerReminders: { ...enabledPrayerReminders },
        prayerRemindersCustomized: false,
      }));
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setMessage("");
    setBusy(true);
    try {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        setMessage(ar ? "لم يتم منح إذن التنبيهات." : "Notification permission was not granted.");
        return;
      }
      await notify(
        ar ? "أذكار" : "Azkar",
        ar ? "هذا تنبيه تجريبي. جزاك الله خيرًا." : "This is a test notification. May Allah reward you.",
      );
      setMessage(ar
        ? "أرسل Windows التنبيه التجريبي. إذا ظهر في مركز الإشعارات فقط، فعّل لافتات Azkar من إعدادات Windows."
        : "The test was sent through Windows notifications. If it only appears in Notification Center, enable notification banners for Azkar in Windows Settings.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : (ar ? "تعذر إرسال التنبيه." : "Could not send the notification."));
    } finally {
      setBusy(false);
    }
  }

  function togglePrayer(name: PrayerName) {
    setPreference((preferences) => ({
      ...preferences,
      prayerReminders: { ...preferences.prayerReminders, [name]: !preferences.prayerReminders[name] },
      prayerRemindersCustomized: true,
    }));
  }

  const locked = !notificationsEnabled || !location;

  return (
    <div className="page reminders-page">
      <section className="card">
        <div className="intro-row">
          <span className="empty-icon"><Icon name="bell" size={22} /></span>
          <div className="grow">
            <span className="eyebrow">{ar ? "على وقتها، دون إزعاج" : "Gentle, timely prompts"}</span>
            <h2>{ar ? "ذكّرك بما يهم" : "A gentle nudge"}</h2>
            <p className="muted">
              {ar
                ? "تُفعّل تذكيرات الصلوات الخمس تلقائيًا عند تشغيل التنبيهات، ويمكنك إيقاف أي صلاة على حدة."
                : "All five prayer reminders turn on automatically. You can still disable individual prayers below."}
            </p>
          </div>
          <div className="switch-field">
            <button
              type="button"
              role="switch"
              aria-checked={notificationsEnabled}
              className="switch"
              onClick={() => void toggleNotifications()}
              disabled={busy}
              aria-label={ar ? "التنبيهات" : "Notifications"}
            />
            <span className="small">
              {notificationsEnabled ? (ar ? "التنبيهات مفعّلة" : "Notifications on") : (ar ? "التنبيهات متوقفة" : "Notifications off")}
            </span>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h3>{ar ? "تذكيرات الصلاة" : "Prayer reminders"}</h3>
            <p className="muted small">
              {location ? `${ar ? "توقيت" : "Times for"} ${location.name}` : (ar ? "أضف موقعًا من الإعدادات." : "Add a location in Settings.")}
            </p>
          </div>
        </div>
        <div className="list">
          {prayers.map((name) => {
            const on = prayerReminders[name];
            return (
              <div className="list-row" key={name}>
                <span className="list-icon"><Icon name={name === "Fajr" || name === "Isha" ? "moon" : "sun"} size={18} /></span>
                <span className="list-title">{prayerNames[name][language]}</span>
                {on && !locked && <span className="badge">{ar ? "عند الأذان" : "At prayer time"}</span>}
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  className="switch"
                  disabled={locked}
                  onClick={() => togglePrayer(name)}
                  aria-label={`${prayerNames[name].en} reminder`}
                />
              </div>
            );
          })}
        </div>

        {notificationsEnabled && (
          <div className="notification-test-row">
            <span className="muted small">{ar ? "أرسل تنبيهًا تجريبيًا، أو افتح إعدادات Windows للتحكم في ظهور اللافتات." : "Send a test notification or open Windows settings to control pop-up banners."}</span>
            <div className="notification-test-actions">
              <button type="button" className="btn btn-ghost" onClick={() => void openExternal("ms-settings:notifications")}>
                {ar ? "إعدادات إشعارات Windows" : "Windows notification settings"}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => void sendTest()} disabled={busy}>
                {ar ? "إرسال تنبيه تجريبي" : "Send test"}
              </button>
            </div>
          </div>
        )}
        {message && <p className="notice" role="status">{message}</p>}
      </section>

      <aside className="notice">
        <Icon name="clock" size={18} />
        <p>
          {ar
            ? "تظهر التذكيرات كإشعارات Windows. إذا وصلت إلى مركز الإشعارات دون ظهور لافتة على الشاشة، فعّل «إظهار لافتات الإشعارات» لتطبيق Azkar من إعدادات Windows ← النظام ← الإشعارات. وتستمر التذكيرات أثناء تشغيل أذكار في منطقة الإشعارات."
            : "Reminders use native Windows notifications. If they reach Notification Center without a pop-up banner, enable “Show notification banners” for Azkar in Windows Settings → System → Notifications. Reminders continue while Azkar is running in the system tray."}
        </p>
      </aside>
    </div>
  );
}
