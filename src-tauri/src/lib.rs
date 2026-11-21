use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    webview::WebviewWindowBuilder,
    window::{Color, Effect, EffectsBuilder},
    AppHandle, Manager, WindowEvent,
};

#[cfg(target_os = "windows")]
fn apply_rounded_window_region<W: raw_window_handle::HasWindowHandle>(
    window: &W,
    width: u32,
    height: u32,
    scale: f64,
    inset: f64,
    radius: f64,
) {
    use raw_window_handle::RawWindowHandle;
    use windows_sys::Win32::Graphics::Gdi::{CreateRoundRectRgn, DeleteObject, SetWindowRgn};

    let Ok(handle) = window.window_handle() else { return; };
    let RawWindowHandle::Win32(handle) = handle.as_raw() else { return; };

    // Match the native window region to the CSS card bounds. This clips both
    // the WebView and the Windows Acrylic material, avoiding square corners
    // or transparent rectangular hit areas around the rounded surface.
    let inset_px = (inset * scale).round() as i32;
    let diameter_px = (radius * 2.0 * scale).round() as i32;
    let right = (width as i32 - inset_px).max(inset_px + 1);
    let bottom = (height as i32 - inset_px).max(inset_px + 1);
    let region = unsafe {
        CreateRoundRectRgn(
            inset_px,
            inset_px,
            right,
            bottom,
            diameter_px,
            diameter_px,
        )
    };
    if region.is_null() {
        return;
    }

    let hwnd = handle.hwnd.get() as _;
    let applied = unsafe { SetWindowRgn(hwnd, region, 1) };
    if applied == 0 {
        unsafe { DeleteObject(region) };
    }
}

fn toggle_tray_popup(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("tray") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
        return;
    }

    let monitor = app.primary_monitor().ok().flatten();
    let (x, y) = monitor.map(|m| {
        let size = m.size();
        let scale = m.scale_factor();
        let width = 420.0;
        let height = 470.0;
        ((m.position().x as f64 / scale) + size.width as f64 / scale - width - 18.0,
         (m.position().y as f64 / scale) + size.height as f64 / scale - height - 54.0)
    }).unwrap_or((900.0, 500.0));

    let builder = WebviewWindowBuilder::new(app, "tray", tauri::WebviewUrl::App("index.html?tray=1".into()))
        .title("")
        .inner_size(420.0, 470.0)
        .position(x, y)
        .decorations(false)
        .transparent(true)
        // Avoid Tauri/Windows adding the thin square white border that can
        // remain visible around transparent, rounded, undecorated windows.
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .visible(false);
    if let Ok(window) = builder.build() {
        // Use the native Windows Acrylic backdrop so the real desktop behind
        // the popup is blurred, rather than relying only on CSS blur inside
        // the WebView. The CSS layer supplies the dark tint and glossy finish.
        let _ = window.set_effects(
            EffectsBuilder::new()
                .effect(Effect::Acrylic)
                .color(Color(8, 9, 12, 154))
                .build(),
        );
        #[cfg(target_os = "windows")]
        if let (Ok(size), Ok(scale)) = (window.inner_size(), window.scale_factor()) {
            apply_rounded_window_region(&window, size.width, size.height, scale, 5.0, 17.0);
        }
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Opening Azkar a second time brings the existing window back instead of starting another copy.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![quit_app])
        // The X button and Alt+F4 hide the window. Azkar keeps running so prayer reminders still arrive.
        .on_window_event(|window, event| {
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = window.hide();
                }
                WindowEvent::Focused(false) if window.label() == "tray" => {
                    let _ = window.hide();
                }
                #[cfg(target_os = "windows")]
                WindowEvent::Resized(size) => {
                    if let Ok(scale) = window.scale_factor() {
                        let (inset, radius) = if window.label() == "tray" {
                            (5.0, 17.0)
                        } else if window.label() == "main" {
                            // The main card is inset by 4px in CSS and has a
                            // 15px radius; 19px here preserves its outer arc
                            // while leaving room for its soft CSS shadow.
                            (0.0, 19.0)
                        } else {
                            return;
                        };
                        apply_rounded_window_region(window, size.width, size.height, scale, inset, radius);
                    }
                }
                _ => {}
            }
        })
        .setup(|app| {
            #[cfg(target_os = "windows")]
            if let Some(main) = app.get_webview_window("main") {
                if let (Ok(size), Ok(scale)) = (main.inner_size(), main.scale_factor()) {
                    apply_rounded_window_region(&main, size.width, size.height, scale, 0.0, 19.0);
                }
            }

            let icon = app
                .default_window_icon()
                .cloned()
                .ok_or("the app icon is missing")?;

            TrayIconBuilder::with_id("azkar-tray")
                .icon(icon)
                .tooltip("Azkar · أذكار")
                // Do not attach a native menu: it would force Windows to show
                // the standard context menu on right-click. Both clicks open
                // the same custom acrylic prayer panel instead.
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left | MouseButton::Right,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_tray_popup(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Azkar");
}
