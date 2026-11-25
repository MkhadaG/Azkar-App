import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { openUrl } from "@tauri-apps/plugin-opener";

export const isDesktop = (): boolean => isTauri();

// The tray icon and its menu live in Rust (src-tauri/src/lib.rs). Closing the window only hides it.
export const closeMainWindow = () => getCurrentWindow().hide();
export const minimizeWindow = () => getCurrentWindow().minimize();
export const toggleMaximizeWindow = () => getCurrentWindow().toggleMaximize();
export const isWindowMaximized = () => getCurrentWindow().isMaximized();
export const onWindowResized = (handler: () => void) => getCurrentWindow().onResized(() => handler());

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isDesktop()) return false;
  if (await isPermissionGranted()) return true;
  return (await requestPermission()) === "granted";
}

export async function notify(title: string, body: string): Promise<void> {
  if (!isDesktop()) return;
  if (!(await isPermissionGranted())) {
    throw new Error("Azkar does not have permission to send Windows notifications.");
  }
  // Wait for the native Windows toast request to complete so the caller can
  // report real delivery errors instead of immediately claiming success.
  await sendNotification({ title, body });
}

export async function openExternal(url: string): Promise<void> {
  if (isDesktop()) {
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
