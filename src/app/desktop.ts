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
  try {
    if (await isPermissionGranted()) sendNotification({ title, body });
  } catch (reason) {
    console.error("Could not show an Azkar notification.", reason);
  }
}

export async function openExternal(url: string): Promise<void> {
  if (isDesktop()) {
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
