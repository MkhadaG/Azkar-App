# Azkar

A calm, private, Arabic-first companion for everyday worship: prayer times, Quran reading, daily adhkar, a tasbih counter and a Hijri calendar.

Built with React, TypeScript and Vite, and packaged as a small native Windows app with [Tauri 2](https://tauri.app). The app uses the WebView2 runtime that Windows already includes, so it does not bundle a browser engine.

## Requirements (Windows)

- Node.js 22.12 or newer
- Rust (stable), installed with `rustup` from https://rustup.rs
- WebView2 runtime (already installed on Windows 10 and 11)

## Develop

```
npm install
npm run tauri dev
```

To preview only the web UI in a browser, run `npm run dev`. Desktop-only features (tray, close-to-tray, native notifications) are disabled there.

Run the tests with `npm test`.

## Build

```
npm run tauri build
```

This produces:

- `src-tauri/target/release/azkar.exe` — a standalone app of a few megabytes. It opens without installing and does not unpack a browser on each launch.
- `src-tauri/target/release/bundle/nsis/` — an installer. Use the installer for everyday use: Windows only shows notifications reliably for installed apps.

## How it works

- **Tray and window:** closing the window keeps Azkar in the system tray so prayer reminders keep arriving. The tray menu shows the next prayer and the time left; "Quit Azkar" stops the app and its reminders.
- **Saved data:** preferences, tasbih count, adhkar progress and Quran bookmarks are stored locally on the device (in the app's WebView storage). Nothing is uploaded.
- **Prayer times** are calculated on the device with the open-source [adhan](https://github.com/batoulapps/adhan-js) library, so they work offline. Choose the calculation method in Settings to match the convention used by your local prayer timetable.
- **Online data:** Quran text and page locations from api.alquran.cloud, page images from the Madina Mushaf images on jsDelivr, and city search from Open-Meteo geocoding. Each response is cached on the device after the first load.

## Asset credits

- Quran page images: [Madina Images](https://github.com/tarekeldeeb/madina_images), served from its documented CDN. The page artwork is based on work from the King Fahd Quran Printing Complex. Images are loaded at runtime and not redistributed with Azkar.
- Arabic UI typeface: IBM Plex Sans Arabic, SIL Open Font License 1.1 (`public/assets/`).
- Arabic reading typeface: Amiri by Khaled Hosny, SIL Open Font License 1.1 (`public/assets/`).
- Icons: Material Design Icons (Apache-2.0), inlined in `src/components/icons.ts`.

## Version 0.4.8

- Matched the taskbar indicator's hover/selected state to the supplied Windows weather reference: fully transparent while idle, with a softly antialiased neutral rounded selection tile while hovered or while the prayer calendar is open.
- Uses the native Win32 `TrackMouseEvent` / `WM_MOUSEHOVER` event with a 1-second delay to open the prayer timetable. Hover-opening does not activate or steal focus from the current app; clicking the indicator toggles the calendar and focuses it when opening by click.
- The taskbar item and calendar are treated as one hover region. The calendar stays open while the pointer moves between the taskbar item and the flyout, and closes only after the pointer has remained outside both for a 900 ms grace period.
- Re-arms native hover/leave tracking after each entry and periodically reconciles the pointer position as a fallback for Windows taskbar flyouts that can swallow mouse-leave events. A completed hover is one-shot, so the calendar cannot repeatedly reopen while the pointer stays still; clicking to close suppresses hover reopening until the pointer leaves and re-enters.
- Slightly increased taskbar text, tuned the dark/light hover overlay to match Windows' neutral taskbar selection surface, and kept the indicator close to the system tray.

## Version 0.4.7

- Replaced the taskbar indicator's embedded WebView with a native Win32 layered child window. The indicator is rendered into a 32-bit DIB and composited with `UpdateLayeredWindow` using per-pixel alpha, so the taskbar material shows through everywhere except the text and divider.
- Added `GdiFlush` before reading the DIB pixels directly. Windows batches GDI drawing; flushing before direct pixel access prevents stale backing pixels from being converted into an opaque rectangle.
- The taskbar window now starts hidden and is shown only after its transparent pixel surface has been uploaded.
- The native window re-submits its layered surface after taskbar flyouts/repaints and handles theme, display, DPI and DWM composition changes. Its 400 ms recovery tick reasserts only child z-order and does not move or resize the widget.
- Slightly increased the indicator's dimensions and typography, using Segoe UI Variable Text with a Segoe UI system fallback and taskbar-aware high-contrast black/white text.
- Removed the obsolete taskbar WebView capability and CSS; the prayer indicator no longer creates an extra WebView.

## Version 0.4.6

- Taskbar indicator uses Windows' system taskbar theme (and taskbar accent color when enabled) to select high-contrast white or black text.
- Removed obsolete widget-size and click-through controls; the indicator uses one compact width and a native Windows hover tooltip.
- Improved calendar toggling so clicking the taskbar indicator closes an already-open calendar instead of reopening it after a focus change.
- Calendar native background colors match the WebView page exactly, with the rounded native window region reapplied after showing and resizing to prevent a rectangular backing surface.
- Calendar theme changes follow the app theme immediately in both directions.
- Visible prayer clock times use 12-hour formatting throughout the app; internal prayer-time calculations retain 24-hour schedule strings.

## Version 0.4.1

- Replaced the floating prayer panel with a compact native child window embedded directly inside the Windows taskbar, positioned beside the system notification area.
- Uses the Windows taskbar host (`Shell_TrayWnd`) with a transparent, non-activating layered window; the indicator shows the next prayer, its local time, and a live countdown.
- Re-aligns with the taskbar notification area as its layout changes and retries attachment after Windows Explorer restarts.

## Version 0.4.0

- Hardened the taskbar prayer widget's native Windows window styles and rounded clipping.
- Replaced legacy window dragging with coalesced smooth positioning; the widget position remains saved.
- Kept native Windows notifications and added clearer guidance for banner preferences in Windows Settings.
- Refined the light palette to warm ivory and gold with darker readable text.
- Made Adhkar, Tasbih and Quran fit normal desktop windows, while preserving scroll on smaller windows.
- Moved Quran fullscreen reading into a body-level overlay while the native window fills the monitor, with dark backdrop and left/right page controls.


## 0.4.0 — Widget, notifications, and reading-layout improvements

- Hardened the Windows taskbar prayer widget as a frameless popup: stripped caption, border, resize and system-menu styles, removed native frame edging, and applied DWM corner/border preferences on Windows 11 with the rounded-window region as a Windows 10 fallback.
- Removed redundant WebView clip-path layers behind the widget so the native Acrylic material is clipped only by the window shape. Kept drag handling as pointer-driven window movement, with saved position, click-through, fixed size choices, and hover dimming.
- Kept prayer reminders on the native Windows notification plugin. The installer uses the app's bundle identity; Windows still controls whether each notification appears as a banner or only in Notification Center.
- Warmed light mode with ivory surfaces, readable brown text, and restrained gold accents.
- Tuned the Azkar, Tasbih, and Quran pages to fit normal desktop window sizes, keeping scrolling for compact windows.
- Portaled Quran full-screen reading to the document root while the native window enters monitor full-screen, with a dark surround and previous/next side controls.
