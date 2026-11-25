import { useEffect, useMemo, useState } from "react";
import type { Language } from "../app/model";
import {
  closeMainWindow,
  isDesktop,
  isWindowMaximized,
  minimizeWindow,
  onWindowResized,
  toggleMaximizeWindow,
} from "../app/desktop";
import brandIcon from "../assets/azkar-icon.png";

export function TitleBar({ language, timezone }: { language: Language; timezone?: string }) {
  const [maximized, setMaximized] = useState(false);
  const desktop = isDesktop();
  const [now, setNow] = useState(() => new Date());
  const dateLabel = useMemo(() => new Intl.DateTimeFormat(language === "ar" ? "ar" : "en", {
    weekday: "long", day: "numeric", month: "long", timeZone: timezone,
  }).format(now), [language, timezone, now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!desktop) return;
    let unlisten: (() => void) | undefined;
    const sync = () => void isWindowMaximized().then(setMaximized);
    sync();
    void onWindowResized(sync).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [desktop]);

  if (!desktop) return null;
  const ar = language === "ar";

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar-brand" data-tauri-drag-region>
        <img src={brandIcon} alt="" width={16} height={16} />
        <span>Azkar</span>
      </div>
      <div className="titlebar-date" data-tauri-drag-region>{dateLabel}</div>
      <div className="titlebar-controls">
        <button type="button" className="win-btn" aria-label={ar ? "تصغير" : "Minimize"} onClick={() => void minimizeWindow()}>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 5.5h8" stroke="currentColor" /></svg>
        </button>
        <button
          type="button"
          className="win-btn"
          aria-label={ar ? (maximized ? "استعادة" : "تكبير") : (maximized ? "Restore" : "Maximize")}
          onClick={() => void toggleMaximizeWindow()}
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1.5h5.5V7M1.5 3v5.5H7V3z" fill="none" stroke="currentColor" /></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" /></svg>
          )}
        </button>
        <button
          type="button"
          className="win-btn win-close"
          aria-label={ar ? "إغلاق إلى الدرج" : "Close to tray"}
          title={ar ? "يبقى أذكار يعمل في منطقة الإشعارات" : "Azkar keeps running in the tray"}
          onClick={() => void closeMainWindow()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" /></svg>
        </button>
      </div>
    </header>
  );
}
