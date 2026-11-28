import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

const CHECK_EVERY_MS = 15 * 60 * 1000;
const DISMISSED_UPDATE_PREFIX = "azkar.dismissed-update.";
const UPDATE_CHECK_HEADERS: Record<string, string> = {
  "Cache-Control": "no-cache, no-store, max-age=0",
  Pragma: "no-cache",
};

type Phase = "available" | "downloading" | "installing" | "failed";

async function checkLatestUpdate(): Promise<Update | null> {
  // Avoid using a cached GitHub "latest" manifest when several releases are
  // published close together.
  return check({ headers: UPDATE_CHECK_HEADERS });
}

function isNewerVersion(candidate: string, current: string): boolean {
  const numbers = (version: string) =>
    version.replace(/^v/i, "").split(/[+-]/, 1)[0].split(".")
      .map((part) => {
        const value = Number.parseInt(part, 10);
        return Number.isFinite(value) ? value : 0;
      });
  const a = numbers(candidate);
  const b = numbers(current);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

async function closeUpdate(update: Update | null): Promise<void> {
  if (!update) return;
  await update.close().catch((error) => {
    console.debug("Could not release an unused update check.", error);
  });
}

function wasDismissed(version: string, fallbackVersion: string | null): boolean {
  if (fallbackVersion === version) return true;
  try {
    return window.sessionStorage.getItem(DISMISSED_UPDATE_PREFIX + version) === "1";
  } catch {
    return false;
  }
}

/** Shows the original v0.4.10 floating update card and installs signed releases in place. */
export function UpdateNotice({ ar }: { ar: boolean }) {
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<Phase>("available");
  const [percent, setPercent] = useState(0);
  const busy = useRef(false);
  const checking = useRef(false);
  const laterVersion = useRef<string | null>(null);
  const pendingUpdate = useRef<Update | null>(null);

  const adoptUpdate = async (next: Update) => {
    const previous = pendingUpdate.current;
    pendingUpdate.current = next;
    setUpdate(next);
    if (previous && previous !== next) await closeUpdate(previous);
  };

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;

    const look = async () => {
      if (busy.current || checking.current) return;
      checking.current = true;
      try {
        const found = await checkLatestUpdate();
        if (cancelled) {
          await closeUpdate(found);
          return;
        }
        if (!found) return;
        if (wasDismissed(found.version, laterVersion.current)) {
          await closeUpdate(found);
          return;
        }

        const current = pendingUpdate.current;
        if (!current || isNewerVersion(found.version, current.version)) {
          await adoptUpdate(found);
          setPhase("available");
        } else {
          await closeUpdate(found);
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

    // The main window may be hidden in the tray without restarting the app.
    // Recheck when it becomes active again, as well as periodically.
    void look();
    window.addEventListener("focus", look);
    document.addEventListener("visibilitychange", checkWhenVisible);
    const timer = window.setInterval(() => void look(), CHECK_EVERY_MS);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", look);
      document.removeEventListener("visibilitychange", checkWhenVisible);
      window.clearInterval(timer);
      const pending = pendingUpdate.current;
      pendingUpdate.current = null;
      void closeUpdate(pending);
    };
  }, []);

  const install = async () => {
    if (busy.current || !pendingUpdate.current) return;
    busy.current = true;
    setPhase("downloading");
    setPercent(0);

    let candidate = pendingUpdate.current;
    try {
      // The card may have been open while a newer release was published.
      // Refresh immediately before downloading, instead of trusting the card's
      // original version.
      const latestBeforeDownload = await checkLatestUpdate();
      if (latestBeforeDownload) {
        if (isNewerVersion(latestBeforeDownload.version, candidate.version)) {
          candidate = latestBeforeDownload;
          await adoptUpdate(candidate);
        } else {
          await closeUpdate(latestBeforeDownload);
        }
      }

      let readyToInstall = false;
      // If another release appears while the package downloads, switch to it
      // before installing. The loop is bounded so a rapid release stream
      // cannot keep the updater busy indefinitely.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        let total = 0;
        let received = 0;
        setPercent(0);

        await candidate.download((event) => {
          if (event.event === "Started") {
            total = event.data.contentLength ?? 0;
          }
          if (event.event === "Progress") {
            received += event.data.chunkLength;
            if (total > 0) {
              setPercent(Math.min(100, Math.round((received / total) * 100)));
            }
          }
          if (event.event === "Finished" && total > 0) setPercent(100);
        });

        const latestAfterDownload = await checkLatestUpdate();
        if (latestAfterDownload && isNewerVersion(latestAfterDownload.version, candidate.version)) {
          candidate = latestAfterDownload;
          await adoptUpdate(candidate);
          continue;
        }
        await closeUpdate(latestAfterDownload);
        readyToInstall = true;
        break;
      }

      if (!readyToInstall) {
        throw new Error("Newer releases kept appearing during the download. Please retry.");
      }

      setPhase("installing");
      // The Windows NSIS updater runs silently, closes Azkar to replace its
      // files, then relaunches the installed app when it has finished.
      await candidate.install({ restartAfterInstall: true });
      // Windows exits during install and is relaunched by NSIS. Other desktop
      // platforms require the app to relaunch itself after installation.
      await relaunch();
    } catch (error) {
      console.error("The update could not be installed.", error);
      busy.current = false;
      setPhase("failed");
    }
  };

  const later = () => {
    const dismissed = pendingUpdate.current;
    if (dismissed) {
      laterVersion.current = dismissed.version;
      try {
        window.sessionStorage.setItem(DISMISSED_UPDATE_PREFIX + dismissed.version, "1");
      } catch {
        // Keep the dismissal for this component session if storage is unavailable.
      }
    }
    pendingUpdate.current = null;
    setUpdate(null);
    void closeUpdate(dismissed);
  };

  if (!update) return null;

  return (
    <div className="update-notice" role="status">
      <div>
        <strong>
          {ar ? "تحديث جديد " + update.version : "Azkar " + update.version + " is available"}
        </strong>
        <span>
          {phase === "failed"
            ? ar ? "تعذّر التحديث، حاول لاحقًا." : "The update failed. Try again later."
            : phase === "downloading"
              ? ar ? "جارٍ تنزيل التحديث..." : "Downloading the update..."
              : phase === "installing"
                ? ar ? "سيُغلق أذكار ويُعاد فتحه بعد التحديث." : "Azkar will close and reopen after the update."
                : ar ? "حدّث الآن أو اختر «ليس الآن» للمتابعة." : "Update now, or choose Not now to continue."}
        </span>
      </div>
      {phase === "available" || phase === "failed" ? (
        <>
          <button className="btn btn-primary" onClick={() => void install()}>
            {ar ? phase === "failed" ? "إعادة المحاولة" : "تحديث" : phase === "failed" ? "Retry" : "Update"}
          </button>
          <button className="btn" onClick={later}>
            {ar ? "ليس الآن" : "Not now"}
          </button>
        </>
      ) : phase === "downloading" ? (
        <span>{percent}%</span>
      ) : (
        <span>{ar ? "جارٍ التحديث..." : "Updating..."}</span>
      )}
    </div>
  );
}
