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

fn taskbar_widget_dimensions(size: &str) -> (f64, f64) {
    match size {
        "compact" => (282.0, 76.0),
        "large" => (390.0, 104.0),
        _ => (326.0, 88.0),
    }
}

#[tauri::command]
fn move_taskbar_widget(app: AppHandle, x: i32, y: i32) -> Result<(), String> {
    let window = app
        .get_webview_window("taskbar-widget")
        .ok_or_else(|| "The prayer widget window is not available.".to_string())?;
    window
        .set_position(tauri::PhysicalPosition::new(x, y))
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "windows")]
fn apply_taskbar_widget_shape(window: &tauri::WebviewWindow) {
    if let (Ok(size), Ok(scale)) = (window.outer_size(), window.scale_factor()) {
        apply_rounded_window_region(window, size.width, size.height, scale, 0.0, 22.0);
    }
}

#[cfg(target_os = "windows")]
fn enforce_taskbar_widget_native_chrome(window: &tauri::WebviewWindow) {
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    use windows_sys::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_WINDOW_CORNER_PREFERENCE,
        DWMWCP_ROUND,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, GWL_STYLE,
        SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER,
        WS_BORDER, WS_CAPTION, WS_CHILD, WS_DLGFRAME, WS_POPUP, WS_THICKFRAME,
        WS_SYSMENU, WS_MINIMIZEBOX, WS_MAXIMIZEBOX, WS_EX_APPWINDOW, WS_EX_CLIENTEDGE,
        WS_EX_DLGMODALFRAME, WS_EX_STATICEDGE, WS_EX_TOOLWINDOW, WS_EX_WINDOWEDGE,
    };

    let Ok(handle) = window.window_handle() else { return; };
    let RawWindowHandle::Win32(handle) = handle.as_raw() else { return; };
    let hwnd = handle.hwnd.get() as _;

    unsafe {
        // Tauri's decoration flag is kept disabled too, but explicitly strip
        // every caption/frame style so Windows cannot show a legacy title bar
        // while the user moves the floating widget.
        let style = GetWindowLongPtrW(hwnd, GWL_STYLE);
        let frame_bits = WS_CAPTION | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX
            | WS_MAXIMIZEBOX | WS_BORDER | WS_DLGFRAME | WS_CHILD;
        // Force a popup-style top-level HWND with no caption, border, resize
        // frame, or system menu. This prevents Windows from reintroducing a
        // legacy title strip when the user drags the floating widget.
        let frameless_style = (style & !(frame_bits as isize)) | WS_POPUP as isize;
        SetWindowLongPtrW(hwnd, GWL_STYLE, frameless_style);

        // Keep it as a lightweight tool window, not a regular application
        // window in Alt+Tab or the taskbar, and remove native edge treatments.
        let extended = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let extended_bits = WS_EX_APPWINDOW | WS_EX_CLIENTEDGE | WS_EX_DLGMODALFRAME
            | WS_EX_STATICEDGE | WS_EX_WINDOWEDGE;
        let tool_style = (extended | WS_EX_TOOLWINDOW as isize) & !(extended_bits as isize);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, tool_style);

        // Windows 11: ask DWM for rounded corners and no visible native frame.
        // On Windows 10 these attributes are unsupported and safely ignored;
        // the explicit window region below remains the cross-version fallback.
        let corner_preference = DWMWCP_ROUND;
        let no_native_border: u32 = 0xFFFF_FFFE;
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE as u32,
            &corner_preference as *const _ as _,
            std::mem::size_of_val(&corner_preference) as u32,
        );
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_BORDER_COLOR as u32,
            &no_native_border as *const _ as _,
            std::mem::size_of_val(&no_native_border) as u32,
        );
        SetWindowPos(
            hwnd,
            std::ptr::null_mut(),
            0,
            0,
            0,
            0,
            SWP_FRAMECHANGED | SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER,
        );
    }
}

#[cfg(target_os = "windows")]
fn apply_taskbar_widget_acrylic(window: &tauri::WebviewWindow) {
    // The native window itself owns the acrylic material. Keep the WebView
    // transparent so no second rectangular CSS blur surface is composited.
    let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
    let _ = window.set_effects(
        EffectsBuilder::new()
            .effect(Effect::Acrylic)
            .color(Color(8, 9, 12, 154))
            .build(),
    );
}

#[cfg(target_os = "windows")]
fn configure_taskbar_widget_native(window: &tauri::WebviewWindow) {
    let _ = window.set_title("");
    let _ = window.set_decorations(false);
    let _ = window.set_resizable(false);
    let _ = window.set_minimizable(false);
    let _ = window.set_maximizable(false);
    let _ = window.set_closable(false);
    let _ = window.set_shadow(false);
    let _ = window.set_skip_taskbar(true);
    enforce_taskbar_widget_native_chrome(window);
    apply_taskbar_widget_shape(window);
}

#[tauri::command]
async fn set_taskbar_widget(
    app: AppHandle,
    enabled: bool,
    click_through: bool,
    size: String,
) -> Result<(), String> {
    if !enabled {
        if let Some(window) = app.get_webview_window("taskbar-widget") {
            let _ = window.set_ignore_cursor_events(false);
            window.hide().map_err(|error| error.to_string())?;
        }
        return Ok(());
    }

    let (width, height) = taskbar_widget_dimensions(&size);
    if let Some(window) = app.get_webview_window("taskbar-widget") {
        window.set_title("").map_err(|error| error.to_string())?;
        window.set_decorations(false).map_err(|error| error.to_string())?;
        window.set_resizable(false).map_err(|error| error.to_string())?;
        let _ = window.set_minimizable(false);
        let _ = window.set_maximizable(false);
        let _ = window.set_closable(false);
        window.set_shadow(false).map_err(|error| error.to_string())?;
        window.set_skip_taskbar(true).map_err(|error| error.to_string())?;
        window.set_always_on_top(true).map_err(|error| error.to_string())?;
        window.set_size(tauri::LogicalSize::new(width, height)).map_err(|error| error.to_string())?;
        window.set_ignore_cursor_events(click_through).map_err(|error| error.to_string())?;
        #[cfg(target_os = "windows")]
        apply_taskbar_widget_acrylic(&window);
        #[cfg(target_os = "windows")]
        configure_taskbar_widget_native(&window);
        window.show().map_err(|error| error.to_string())?;
        #[cfg(target_os = "windows")]
        {
            apply_taskbar_widget_acrylic(&window);
            configure_taskbar_widget_native(&window);
        }
        return Ok(());
    }

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

    window.set_title("").map_err(|error| error.to_string())?;
    window.set_decorations(false).map_err(|error| error.to_string())?;
    window.set_resizable(false).map_err(|error| error.to_string())?;
    let _ = window.set_minimizable(false);
    let _ = window.set_maximizable(false);
    let _ = window.set_closable(false);
    window.set_shadow(false).map_err(|error| error.to_string())?;
    window.set_skip_taskbar(true).map_err(|error| error.to_string())?;
    window.set_always_on_top(true).map_err(|error| error.to_string())?;
    window.set_ignore_cursor_events(click_through).map_err(|error| error.to_string())?;
    #[cfg(target_os = "windows")]
    apply_taskbar_widget_acrylic(&window);
    #[cfg(target_os = "windows")]
    configure_taskbar_widget_native(&window);
    window.show().map_err(|error| error.to_string())?;
    #[cfg(target_os = "windows")]
    {
        apply_taskbar_widget_acrylic(&window);
        configure_taskbar_widget_native(&window);
    }
    Ok(())
}

#[tauri::command]
fn set_quran_fullscreen(app: AppHandle, enabled: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "The main Azkar window is not available.".to_string())?;
    window.set_fullscreen(enabled).map_err(|error| error.to_string())?;
    #[cfg(target_os = "windows")]
    if enabled {
        use raw_window_handle::HasWindowHandle;
        use raw_window_handle::RawWindowHandle;
        use windows_sys::Win32::Graphics::Gdi::SetWindowRgn;
        if let Ok(handle) = window.window_handle() {
            if let RawWindowHandle::Win32(handle) = handle.as_raw() {
                unsafe { SetWindowRgn(handle.hwnd.get() as _, std::ptr::null_mut(), 1); }
            }
        }
    }
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
            move_taskbar_widget,
            set_quran_fullscreen,
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
                if window.label() == "main" && window.is_fullscreen().unwrap_or(false) {
                    #[cfg(target_os = "windows")]
                    {
                        use raw_window_handle::HasWindowHandle;
                        use raw_window_handle::RawWindowHandle;
                        use windows_sys::Win32::Graphics::Gdi::SetWindowRgn;
                        if let Ok(handle) = window.window_handle() {
                            if let RawWindowHandle::Win32(handle) = handle.as_raw() {
                                unsafe { SetWindowRgn(handle.hwnd.get() as _, std::ptr::null_mut(), 1); }
                            }
                        }
                    }
                } else if let Ok(scale) = window.scale_factor() {
                    let (inset, radius) = match window.label() {
                        "tray" => (5.0, 17.0),
                        "main" => (0.0, 19.0),
                        "taskbar-widget" => (0.0, 22.0),
                        _ => return,
                    };
                    let dimensions = window.outer_size().unwrap_or(*size);
                    apply_rounded_window_region(window, dimensions.width, dimensions.height, scale, inset, radius);
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
