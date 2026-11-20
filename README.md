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
