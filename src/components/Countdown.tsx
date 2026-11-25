import { useEffect, useState } from "react";

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const parts = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
  return parts.map((part) => String(part).padStart(2, "0")).join(" : ");
}

/** Re-renders on the given interval. Keeps timers local so pages do not re-render every second. */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function Countdown({ target, className }: { target: Date; className?: string }) {
  const now = useNow(1000);
  return <span className={className} dir="ltr">{formatCountdown(target.getTime() - now.getTime())}</span>;
}
