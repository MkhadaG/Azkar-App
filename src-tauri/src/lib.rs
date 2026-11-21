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

fn taskbar_widget_dimensions(size: &str) -> (f64, f64) {
    match size {
        "compact" => (190.0, 30.0),
        "large" => (270.0, 30.0),
        _ => (232.0, 30.0),
    }
}

#[cfg(target_os = "windows")]
fn attach_taskbar_widget_to_shell(
    window: &tauri::WebviewWindow,
    click_through: bool,
) -> Result<(), String> {
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    use windows_sys::Win32::Foundation::{POINT, RECT};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        FindWindowExW, FindWindowW, GetClientRect, GetParent, GetWindowLongPtrW,
        GetWindowRect, ScreenToClient, SetLayeredWindowAttributes, SetParent,
        SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, GWL_STYLE, LWA_ALPHA,
        SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOZORDER, WS_CAPTION, WS_CHILD,
        WS_CLIPSIBLINGS, WS_EX_APPWINDOW, WS_EX_LAYERED, WS_EX_NOACTIVATE,
        WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT, WS_MAXIMIZEBOX, WS_MINIMIZEBOX,
        WS_POPUP, WS_SYSMENU, WS_THICKFRAME,
    };

    let handle = window
        .window_handle()
        .map_err(|error| format!("Could not access the taskbar widget window: {error}"))?;
    let RawWindowHandle::Win32(handle) = handle.as_raw() else {
        return Err("The taskbar widget requires a native Windows window.".to_string());
    };
    let hwnd = handle.hwnd.get() as windows_sys::Win32::Foundation::HWND;

    let taskbar_class: Vec<u16> = "Shell_TrayWnd".encode_utf16().chain(std::iter::once(0)).collect();
    let tray_class: Vec<u16> = "TrayNotifyWnd".encode_utf16().chain(std::iter::once(0)).collect();
    let taskbar = unsafe { FindWindowW(taskbar_class.as_ptr(), std::ptr::null()) };
    if taskbar.is_null() {
        return Err("Windows taskbar was not found. Restart Windows Explorer and try again.".to_string());
    }

    let mut client = RECT::default();
    if unsafe { GetClientRect(taskbar, &mut client) } == 0 {
        return Err("Could not read the Windows taskbar layout.".to_string());
    }

    let size = window
        .inner_size()
        .map_err(|error| format!("Could not read the prayer indicator size: {error}"))?;
    let width = size.width.min(i32::MAX as u32) as i32;
    let height = size.height.min(i32::MAX as u32) as i32;
    if width <= 0 || height <= 0 {
        return Err("The prayer indicator has an invalid size.".to_string());
    }

    let tray = unsafe {
        FindWindowExW(taskbar, std::ptr::null_mut(), tray_class.as_ptr(), std::ptr::null())
    };
    let (tray_left, tray_top) = if !tray.is_null() {
        let mut tray_rect = RECT::default();
        if unsafe { GetWindowRect(tray, &mut tray_rect) } != 0 {
            let mut point = POINT { x: tray_rect.left, y: tray_rect.top };
            unsafe { ScreenToClient(taskbar, &mut point) };
            (point.x, point.y)
        } else {
            (client.right, client.bottom)
        }
    } else {
        (client.right, client.bottom)
    };

    let taskbar_width = client.right - client.left;
    let taskbar_height = client.bottom - client.top;
    if taskbar_width <= taskbar_height || taskbar_width < width || taskbar_height < height {
        return Err("Azkar's taskbar indicator needs a horizontal Windows taskbar with enough room. Move the taskbar to the top or bottom of the screen and try again.".to_string());
    }
    let margin = (window.scale_factor().unwrap_or(1.0) * 6.0).round() as i32;
    let (mut x, mut y) = (tray_left - width - margin, (taskbar_height - height) / 2);
    x = x.clamp(0, (taskbar_width - width).max(0));
    y = y.clamp(0, (taskbar_height - height).max(0));

    unsafe {
        // Make this a lightweight, non-activating taskbar child rather than a
        // top-level app window. WS_EX_LAYERED keeps transparent WebView pixels
        // composited correctly; WS_EX_TRANSPARENT enables the optional
        // click-through mode without a second floating window.
        let previous_parent = GetParent(hwnd);
        let parent_changed = previous_parent != taskbar;

        let old_extended = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let mut extended = old_extended;
        extended |= (WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_LAYERED) as isize;
        extended &= !(WS_EX_APPWINDOW as isize);
        if click_through {
            extended |= WS_EX_TRANSPARENT as isize;
        } else {
            extended &= !(WS_EX_TRANSPARENT as isize);
        }
        if extended != old_extended {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, extended);
        }
        if old_extended & (WS_EX_LAYERED as isize) == 0 {
            let _ = SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA);
        }

        let current_style = GetWindowLongPtrW(hwnd, GWL_STYLE);
        let remove = (WS_POPUP | WS_CAPTION | WS_THICKFRAME | WS_SYSMENU
            | WS_MINIMIZEBOX | WS_MAXIMIZEBOX) as isize;
        let child_style = (current_style & !remove)
            | WS_CHILD as isize
            | WS_CLIPSIBLINGS as isize;
        let style_changed = child_style != current_style;
        if style_changed {
            SetWindowLongPtrW(hwnd, GWL_STYLE, child_style);
        }

        if parent_changed {
            SetParent(hwnd, taskbar);
            if GetParent(hwnd) != taskbar {
                return Err("Windows could not attach the prayer indicator to the taskbar.".to_string());
            }
        }

        // Avoid forcing a repaint every time the lightweight alignment timer
        // runs. Only move the child HWND when the shell or widget size changed.
        let mut current_rect = RECT::default();
        let mut position_changed = true;
        if GetWindowRect(hwnd, &mut current_rect) != 0 {
            let mut current_point = POINT { x: current_rect.left, y: current_rect.top };
            ScreenToClient(taskbar, &mut current_point);
            position_changed = current_point.x != x
                || current_point.y != y
                || current_rect.right - current_rect.left != width
                || current_rect.bottom - current_rect.top != height;
        }
        if position_changed || parent_changed || style_changed {
            let mut flags = SWP_NOACTIVATE | SWP_NOZORDER;
            if parent_changed || style_changed {
                flags |= SWP_FRAMECHANGED;
            }
            if SetWindowPos(hwnd, std::ptr::null_mut(), x, y, width, height, flags) == 0 {
                return Err("Windows could not position the prayer indicator inside the taskbar.".to_string());
            }
        }
    }

    Ok(())
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
    let window = if let Some(window) = app.get_webview_window("taskbar-widget") {
        window
            .set_size(tauri::LogicalSize::new(width, height))
            .map_err(|error| error.to_string())?;
        window
    } else {
        WebviewWindowBuilder::new(
            &app,
            "taskbar-widget",
            tauri::WebviewUrl::App("index.html?widget=1".into()),
        )
        .title("")
        .inner_size(width, height)
        .position(0.0, 0.0)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(false)
        .skip_taskbar(true)
        .resizable(false)
        .visible(false)
        .build()
        .map_err(|error| error.to_string())?
    };

    window.set_title("").map_err(|error| error.to_string())?;
    window.set_decorations(false).map_err(|error| error.to_string())?;
    window.set_resizable(false).map_err(|error| error.to_string())?;
    let _ = window.set_minimizable(false);
    let _ = window.set_maximizable(false);
    let _ = window.set_closable(false);
    window.set_shadow(false).map_err(|error| error.to_string())?;
    window.set_skip_taskbar(true).map_err(|error| error.to_string())?;
    let _ = window.set_always_on_top(false);
    window
        .set_ignore_cursor_events(click_through)
        .map_err(|error| error.to_string())?;
    #[cfg(target_os = "windows")]
    {
        let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
        attach_taskbar_widget_to_shell(&window, click_through)?;
    }
    #[cfg(not(target_os = "windows"))]
    return Err("The embedded taskbar indicator is currently supported on Windows only.".to_string());

    window.show().map_err(|error| error.to_string())?;
    #[cfg(target_os = "windows")]
    attach_taskbar_widget_to_shell(&window, click_through)?;
    Ok(())
}

#[tauri::command]
async fn reposition_taskbar_widget(app: AppHandle, click_through: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("taskbar-widget")
        .ok_or_else(|| "The taskbar prayer indicator is not available.".to_string())?;
    #[cfg(target_os = "windows")]
    {
        attach_taskbar_widget_to_shell(&window, click_through)?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    Err("The embedded taskbar indicator is currently supported on Windows only.".to_string())
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
            set_quran_fullscreen,
            reposition_taskbar_widget,
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
