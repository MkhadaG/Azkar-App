import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { AppState } from "../app/model";
import type { PrayerSchedule } from "../services/prayer";
import { nextPrayer, prayerNames } from "../services/prayer";

interface Props {
  state: AppState;
  schedules: PrayerSchedule[];
}

function countdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

interface DragState {
  pointerId: number;
  startPointerX: number;
  startPointerY: number;
  startWindowX: number;
  startWindowY: number;
  scale: number;
  lastX: number;
  lastY: number;
}

export function TaskbarPrayerWidget({ state, schedules }: Props) {
  const ar = state.preferences.language === "ar";
  const location = state.preferences.location;
  const [now, setNow] = useState(() => new Date());
  const dragRef = useRef<DragState | null>(null);
  const moveFrameRef = useRef<number | null>(null);
  const pendingMoveRef = useRef<{ x: number; y: number } | null>(null);
  const movePumpRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const upcoming = useMemo(() => nextPrayer(schedules, now), [schedules, now]);
  const remaining = upcoming ? upcoming.at.getTime() - now.getTime() : 0;
  const prayerTime = upcoming
    ? new Intl.DateTimeFormat(ar ? "ar" : "en", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: location?.timezone,
      }).format(upcoming.at)
    : "—";
  const prayerLabel = upcoming
    ? prayerNames[upcoming.name][ar ? "ar" : "en"]
    : ar ? "اختر موقعك" : "Choose your location";

  useEffect(() => {
    const widgetWindow = getCurrentWindow();
    let disposed = false;
    let saveTimer: number | undefined;
    let unlisten: (() => void) | undefined;

    void widgetWindow.onMoved(() => {
      if (saveTimer !== undefined) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        void invoke("save_taskbar_widget_position").catch((reason) => {
          console.error("Could not save the Azkar widget position.", reason);
        });
      }, 350);
    }).then((stopListening) => {
      if (disposed) stopListening();
      else unlisten = stopListening;
    }).catch((reason) => console.error("Could not watch the Azkar widget position.", reason));

    return () => {
      disposed = true;
      if (saveTimer !== undefined) window.clearTimeout(saveTimer);
      unlisten?.();
    };
  }, []);

  async function startWidgetDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || state.preferences.taskbarWidgetClickThrough) return;
    event.preventDefault();

    // React resets currentTarget after the event handler returns. Keep the
    // element and pointer coordinates before awaiting the native window APIs.
    const element = event.currentTarget;
    const pointerId = event.pointerId;
    const pointerX = event.screenX;
    const pointerY = event.screenY;
    element.setPointerCapture(pointerId);

    try {
      const widgetWindow = getCurrentWindow();
      const [position, scale] = await Promise.all([widgetWindow.outerPosition(), widgetWindow.scaleFactor()]);
      if (!element.hasPointerCapture(pointerId)) return;
      dragRef.current = {
        pointerId,
        startPointerX: pointerX,
        startPointerY: pointerY,
        startWindowX: position.x,
        startWindowY: position.y,
        scale,
        lastX: position.x,
        lastY: position.y,
      };
    } catch (reason) {
      try { element.releasePointerCapture(pointerId); } catch { /* The pointer may already be released. */ }
      console.error("Could not start moving the Azkar taskbar widget.", reason);
    }
  }

  function queueWidgetPosition(x: number, y: number): Promise<void> {
    pendingMoveRef.current = { x, y };
    if (!movePumpRef.current) {
      movePumpRef.current = (async () => {
        // Coalesce fast pointer updates instead of piling IPC calls up on a
        // slower PC. The native window follows the latest available position.
        while (pendingMoveRef.current) {
          const next = pendingMoveRef.current;
          pendingMoveRef.current = null;
          await invoke("move_taskbar_widget", next);
        }
      })().catch((reason) => {
        console.error("Could not move the Azkar taskbar widget.", reason);
      }).finally(() => {
        movePumpRef.current = null;
        if (pendingMoveRef.current) {
          const pending = pendingMoveRef.current;
          void queueWidgetPosition(pending.x, pending.y);
        }
      });
    }
    return movePumpRef.current;
  }

  function moveWidget(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    drag.lastX = Math.round(drag.startWindowX + (event.screenX - drag.startPointerX) * drag.scale);
    drag.lastY = Math.round(drag.startWindowY + (event.screenY - drag.startPointerY) * drag.scale);
    if (moveFrameRef.current !== null) return;
    moveFrameRef.current = window.requestAnimationFrame(() => {
      moveFrameRef.current = null;
      const current = dragRef.current;
      if (!current) return;
      void queueWidgetPosition(current.lastX, current.lastY);
    });
  }

  function finishWidgetDrag(event: PointerEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    dragRef.current = null;
    if (moveFrameRef.current !== null) {
      window.cancelAnimationFrame(moveFrameRef.current);
      moveFrameRef.current = null;
    }
    void queueWidgetPosition(drag.lastX, drag.lastY)
      .then(() => invoke("save_taskbar_widget_position"))
      .catch((reason) => console.error("Could not save the Azkar taskbar widget position.", reason));
    try {
      element.releasePointerCapture(event.pointerId);
    } catch {
      // The window may have lost pointer capture while it was being moved.
    }
  }

  return (
    <main className={`taskbar-widget-root${state.preferences.taskbarWidgetClickThrough ? " is-click-through" : ""}`}>
      <div
        className={`taskbar-widget-card is-${state.preferences.taskbarWidgetSize}`}
        role="group"
        onPointerDown={(event) => void startWidgetDrag(event)}
        onPointerMove={moveWidget}
        onPointerUp={finishWidgetDrag}
        onPointerCancel={finishWidgetDrag}
        onLostPointerCapture={(event) => finishWidgetDrag(event)}
        onDragStart={(event) => event.preventDefault()}
        onContextMenu={(event) => event.preventDefault()}
        aria-label={ar ? "عنصر مواقيت الصلاة القابل للسحب" : "Draggable prayer times widget"}
      >
        <span className="taskbar-widget-accent" />
        <div className="taskbar-widget-content">
          <div className="taskbar-widget-copy">
            <span className="taskbar-widget-eyebrow">{ar ? "الصلاة القادمة" : "NEXT PRAYER"}</span>
            <strong className="taskbar-widget-prayer" dir={ar ? "rtl" : "ltr"}>{prayerLabel}</strong>
            <span className="taskbar-widget-location">{location?.name ?? (ar ? "أضف موقعك لعرض المواقيت" : "Add a location to see prayer times")}</span>
          </div>
          <div className="taskbar-widget-clock" dir="ltr">
            <strong>{prayerTime}</strong>
            <span>{upcoming ? countdown(remaining) : "--:--:--"}</span>
          </div>
        </div>
        <span className="taskbar-widget-bottom-line" />
      </div>
    </main>
  );
}
