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
- **Prayer times** are calculated on the device with the open-source [adhan](https://github.com/batoulapps/adhan-js) library, so they work offline. Choose the calculation method in Settings (the Egyptian General Authority method is chosen automatically for Egyptian cities) and fine-tune each prayer by minutes if your mosque's timetable differs.
- **Online data:** Quran text and page locations from api.alquran.cloud, page images from the Madina Mushaf images on jsDelivr, and city search from Open-Meteo geocoding. Each response is cached on the device after the first load.

## Asset credits

- Quran page images: [Madina Images](https://github.com/tarekeldeeb/madina_images), served from its documented CDN. The page artwork is based on work from the King Fahd Quran Printing Complex. Images are loaded at runtime and not redistributed with Azkar.
- Arabic UI typeface: IBM Plex Sans Arabic, SIL Open Font License 1.1 (`public/assets/`).
- Arabic reading typeface: Amiri by Khaled Hosny, SIL Open Font License 1.1 (`public/assets/`).
- Icons: Material Design Icons (Apache-2.0), inlined in `src/components/icons.ts`.

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
