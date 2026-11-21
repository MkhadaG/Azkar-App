use std::{fs, path::PathBuf};

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

    let inset_px = (inset * scale).round() as i32;
    let diameter_px = (radius * 2.0 * scale).round() as i32;
    let right = (width as i32 - inset_px).max(inset_px + 1);
    let bottom = (height as i32 - inset_px).max(inset_px + 1);
    let region = unsafe {
        CreateRoundRectRgn(inset_px, inset_px, right, bottom, diameter_px, diameter_px)
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

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn open_main_window(app: AppHandle) {
    show_main_window(&app);
    if let Some(tray) = app.get_webview_window("tray") {
        let _ = tray.hide();
    }
}

#[tauri::command]
fn hide_tray_popup(app: AppHandle) {
    if let Some(window) = app.get_webview_window("tray") {
        let _ = window.hide();
    }
}

fn toggle_tray_popup(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("tray") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
            // Re-trigger the entrance animation when reusing the hidden WebView.
            let _ = window.eval("window.dispatchEvent(new Event('azkar-tray-open'));");
        }
        return;
    }

    let monitor = app.primary_monitor().ok().flatten();
    let (x, y) = monitor.map(|m| {
        let size = m.size();
        let scale = m.scale_factor();
        let width = 420.0;
        let height = 470.0;
        (
            (m.position().x as f64 / scale) + size.width as f64 / scale - width - 18.0,
            (m.position().y as f64 / scale) + size.height as f64 / scale - height - 54.0,
        )
    }).unwrap_or((900.0, 500.0));

    let builder = WebviewWindowBuilder::new(
        app,
        "tray",
        tauri::WebviewUrl::App("index.html?tray=1".into()),
    )
    .title("")
    .inner_size(420.0, 470.0)
    .position(x, y)
    .decorations(false)
    .transparent(true)
    .shadow(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .visible(false);

    if let Ok(window) = builder.build() {
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

fn taskbar_widget_position_file(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app.path().app_config_dir().map_err(|error| error.to_string())?;
    Ok(directory.join("taskbar-widget-position.txt"))
}

fn saved_taskbar_widget_position(app: &AppHandle) -> Option<(f64, f64)> {
    let path = taskbar_widget_position_file(app).ok()?;
    let saved = fs::read_to_string(path).ok()?;
    let (x, y) = saved.trim().split_once(',')?;
    let x = x.parse::<f64>().ok()?;
    let y = y.parse::<f64>().ok()?;
    (x.is_finite() && y.is_finite()).then_some((x, y))
}

#[tauri::command]
fn save_taskbar_widget_position(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("taskbar-widget")
        .ok_or_else(|| "The prayer widget window is not available.".to_string())?;
    let position = window.outer_position().map_err(|error| error.to_string())?;
    let scale = window.scale_factor().map_err(|error| error.to_string())?;
    if !scale.is_finite() || scale <= 0.0 {
        return Err("The display scale is invalid.".to_string());
    }
    let path = taskbar_widget_position_file(&app)?;
    let parent = path
        .parent()
        .ok_or_else(|| "The widget settings folder is unavailable.".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let x = position.x as f64 / scale;
    let y = position.y as f64 / scale;
    fs::write(path, format!("{x:.3},{y:.3}")).map_err(|error| error.to_string())
}

fn taskbar_widget_position(app: &AppHandle, width: f64, height: f64) -> (f64, f64) {
    if let Ok(Some(monitor)) = app.primary_monitor() {
        let work_area = monitor.work_area();
        let scale = monitor.scale_factor();
        let right = work_area.position.x as f64 + work_area.size.width as f64;
        let bottom = work_area.position.y as f64 + work_area.size.height as f64;
        return (
            right / scale - width - 14.0,
            bottom / scale - height - 10.0,
        );
    }
    (900.0, 700.0)
}

#[tauri::command]
async fn set_taskbar_widget(app: AppHandle, enabled: bool) -> Result<(), String> {
    if !enabled {
        if let Some(window) = app.get_webview_window("taskbar-widget") {
            window.hide().map_err(|error| error.to_string())?;
        }
        return Ok(());
    }

    if let Some(window) = app.get_webview_window("taskbar-widget") {
        window.set_decorations(false).map_err(|error| error.to_string())?;
        window.set_resizable(false).map_err(|error| error.to_string())?;
        window.set_shadow(false).map_err(|error| error.to_string())?;
        window.set_skip_taskbar(true).map_err(|error| error.to_string())?;
        window.set_always_on_top(true).map_err(|error| error.to_string())?;
        window.show().map_err(|error| error.to_string())?;
        return Ok(());
    }

    let width = 326.0;
    let height = 88.0;
    let (x, y) = saved_taskbar_widget_position(&app)
        .unwrap_or_else(|| taskbar_widget_position(&app, width, height));
    let window = WebviewWindowBuilder::new(
        &app,
        "taskbar-widget",
        tauri::WebviewUrl::App("index.html?widget=1".into()),
    )
    .title("")
    .inner_size(width, height)
    .position(x, y)
    .decorations(false)
    .transparent(true)
    .shadow(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .visible(false)
    .build()
    .map_err(|error| error.to_string())?;

    window.set_decorations(false).map_err(|error| error.to_string())?;
    window.set_resizable(false).map_err(|error| error.to_string())?;
    window.set_shadow(false).map_err(|error| error.to_string())?;
    window.set_skip_taskbar(true).map_err(|error| error.to_string())?;
    window.set_always_on_top(true).map_err(|error| error.to_string())?;
    let _ = window.set_effects(
        EffectsBuilder::new()
            .effect(Effect::Acrylic)
            .color(Color(8, 9, 12, 154))
            .build(),
    );
    #[cfg(target_os = "windows")]
    if let (Ok(size), Ok(scale)) = (window.inner_size(), window.scale_factor()) {
        // Clip the complete native Acrylic surface, not an inset rectangle.
        // The webview card is inset in CSS, but the native backdrop must have
        // its own full-window rounded region or a square halo can remain visible.
        apply_rounded_window_region(&window, size.width, size.height, scale, 0.0, 22.0);
    }
    window.show().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn set_open_on_startup(app: AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let manager = app.autolaunch();
    if enabled {
        manager.enable().map_err(|error| error.to_string())
    } else {
        manager.disable().map_err(|error| error.to_string())
    }
}

#[tauri::command]
fn is_open_on_startup(app: AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch()
        .is_enabled()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .args(["--azkar-startup"])
                .app_name("Azkar")
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            open_main_window,
            hide_tray_popup,
            set_taskbar_widget,
            save_taskbar_widget_position,
            set_open_on_startup,
            is_open_on_startup,
            quit_app
        ])
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            WindowEvent::Focused(false) if window.label() == "tray" => {
                let _ = window.hide();
            }
            WindowEvent::Focused(true) if window.label() == "main" => {
                if let Some(widget) = window.app_handle().get_webview_window("taskbar-widget") {
                    let _ = widget.set_always_on_top(false);
                }
            }
            WindowEvent::Focused(false) if window.label() == "main" => {
                if let Some(widget) = window.app_handle().get_webview_window("taskbar-widget") {
                    let _ = widget.set_always_on_top(true);
                }
            }
            #[cfg(target_os = "windows")]
            WindowEvent::Resized(size) => {
                if let Ok(scale) = window.scale_factor() {
                    let (inset, radius) = match window.label() {
                        "tray" => (5.0, 17.0),
                        "main" => (0.0, 19.0),
                        "taskbar-widget" => (0.0, 22.0),
                        _ => return,
                    };
                    apply_rounded_window_region(window, size.width, size.height, scale, inset, radius);
                }
            }
            _ => {}
        })
        .setup(|app| {
            let startup_launch = std::env::args().any(|arg| arg == "--azkar-startup");

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
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.set_icon(icon.clone());
            }

            TrayIconBuilder::with_id("azkar-tray")
                .icon(icon)
                .tooltip("Azkar · أذكار")
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left | MouseButton::Right,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        // WebviewWindowBuilder can deadlock on Windows when called
                        // directly from a synchronous tray event handler. Move popup
                        // creation/toggling onto Tauri's async runtime instead.
                        let app = tray.app_handle().clone();
                        tauri::async_runtime::spawn(async move {
                            toggle_tray_popup(&app);
                        });
                    }
                })
                .build(app)?;

            // The main window starts hidden. Manual launches show it here;
            // Windows startup launches keep it in the tray in the background.
            if !startup_launch {
                show_main_window(app.handle());
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Azkar");
}
