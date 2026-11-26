import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

const CHECK_EVERY_MS = 15 * 60 * 1000;
const DISMISSED_UPDATE_PREFIX = "azkar.dismissed-update.";

type Phase = "available" | "downloading" | "installing" | "failed";

function wasDismissed(version: string, fallbackVersion: string | null): boolean {
  if (fallbackVersion === version) return true;
  try {
    return window.sessionStorage.getItem(`${DISMISSED_UPDATE_PREFIX}${version}`) === "1";
  } catch {
    return false;
  }
}

/** Shows an in-page banner for newer signed releases and installs them in place. */
export function UpdateNotice({ ar }: { ar: boolean }) {
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<Phase>("available");
  const [percent, setPercent] = useState(0);
  const busy = useRef(false);
  const checking = useRef(false);
  const laterVersion = useRef<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    const look = async () => {
      if (busy.current || checking.current) return;
      checking.current = true;
      try {
        const found = await check();
        if (!cancelled && found && !wasDismissed(found.version, laterVersion.current)) {
          setUpdate(found);
          setPhase("available");
        }
      } catch (error) {
        console.warn("Could not check for updates.", error);
      } finally {
        checking.current = false;
      }
    };
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") void look();
    };

    // The main window can be hidden in the tray without restarting the app.
    // Recheck when the user brings it back, so newly published releases appear immediately.
    void look();
    window.addEventListener("focus", look);
    document.addEventListener("visibilitychange", checkWhenVisible);
    const timer = window.setInterval(() => void look(), CHECK_EVERY_MS);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", look);
      document.removeEventListener("visibilitychange", checkWhenVisible);
      window.clearInterval(timer);
    };
  }, []);

  const install = async () => {
    if (!update) return;
    busy.current = true;
    setPhase("downloading");
    setPercent(0);
    let total = 0;
    let received = 0;
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          received += event.data.chunkLength;
          if (total > 0) setPercent(Math.min(100, Math.round((received / total) * 100)));
        }
        if (event.event === "Finished") setPhase("installing");
      });
      await relaunch();
    } catch (error) {
      console.error("The update could not be installed.", error);
      busy.current = false;
      setPhase("failed");
    }
  };

  const later = () => {
    if (update) {
      laterVersion.current = update.version;
      try {
        window.sessionStorage.setItem(`${DISMISSED_UPDATE_PREFIX}${update.version}`, "1");
      } catch {
        // Keep the dismissal for this component session if storage is unavailable.
      }
    }
    setUpdate(null);
  };

  if (!update) return null;

  return (
    <section className="update-notice" role="status" aria-live="polite">
      <div className="update-notice-copy">
        <strong>
          {ar ? `يتوفر تحديث جديد من أذكار (${update.version})` : `Azkar ${update.version} is available`}
        </strong>
        <span>
          {phase === "failed"
            ? ar ? "تعذّر تثبيت التحديث. حاول مرة أخرى." : "The update could not be installed. Try again."
            : phase === "downloading"
              ? ar ? "جارٍ تنزيل التحديث..." : "Downloading the update..."
              : phase === "installing"
                ? ar ? "جارٍ تثبيت التحديث وإعادة تشغيل التطبيق..." : "Installing the update and restarting Azkar..."
                : ar ? "حدّث الآن أو اختر «ليس الآن» للمتابعة." : "Update now, or choose Not now to continue."}
        </span>
      </div>
      {phase === "available" || phase === "failed" ? (
        <div className="update-notice-actions">
          <button type="button" className="btn btn-primary" onClick={() => void install()}>
            {ar ? phase === "failed" ? "إعادة المحاولة" : "تحديث" : phase === "failed" ? "Retry" : "Update"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={later}>
            {ar ? "ليس الآن" : "Not now"}
          </button>
        </div>
      ) : (
        <div className="update-notice-actions">
          <span>{phase === "downloading" ? `${percent}%` : ar ? "جارٍ التثبيت..." : "Installing..."}</span>
        </div>
      )}
    </section>
  );
}
