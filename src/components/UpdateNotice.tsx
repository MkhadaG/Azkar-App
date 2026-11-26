import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

type Phase = "available" | "downloading" | "installing" | "failed";

/** Shows a card when a newer signed release is published, and installs it in place. */
export function UpdateNotice({ ar }: { ar: boolean }) {
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<Phase>("available");
  const [percent, setPercent] = useState(0);
  const busy = useRef(false);
  const laterVersion = useRef<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    const look = async () => {
      if (busy.current) return;
      try {
        const found = await check();
        if (!cancelled && found && found.version !== laterVersion.current) {
          setUpdate(found);
          setPhase("available");
        }
      } catch (error) {
        console.warn("Could not check for updates.", error);
      }
    };
    void look();
    const timer = window.setInterval(() => void look(), CHECK_EVERY_MS);
    return () => {
      cancelled = true;
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
    if (update) laterVersion.current = update.version;
    setUpdate(null);
  };

  if (!update) return null;

  return (
    <div className="update-notice" role="status">
      <div>
        <strong>
          {ar ? `تحديث جديد ${update.version}` : `Azkar ${update.version} is available`}
        </strong>
        <span>
          {phase === "failed"
            ? ar ? "تعذّر التحديث، حاول لاحقًا." : "The update failed. Try again later."
            : ar ? "سيتم إعادة تشغيل التطبيق بعد التثبيت." : "Azkar will restart after the update."}
        </span>
      </div>
      {phase === "available" || phase === "failed" ? (
        <>
          <button className="btn btn-primary" onClick={() => void install()}>
            {ar ? "تثبيت" : "Install"}
          </button>
          <button className="btn" onClick={later}>
            {ar ? "لاحقًا" : "Later"}
          </button>
        </>
      ) : phase === "downloading" ? (
        <span>{percent}%</span>
      ) : (
        <span>{ar ? "جارٍ التثبيت..." : "Installing..."}</span>
      )}
    </div>
  );
}
