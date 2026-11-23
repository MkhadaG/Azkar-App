use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};

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


#[cfg(target_os = "windows")]
fn apply_square_window_region<W: raw_window_handle::HasWindowHandle>(
    window: &W,
    width: u32,
    height: u32,
) {
    use raw_window_handle::RawWindowHandle;
    use windows_sys::Win32::Graphics::Gdi::{CreateRectRgn, DeleteObject, SetWindowRgn};

    let Ok(handle) = window.window_handle() else { return; };
    let RawWindowHandle::Win32(handle) = handle.as_raw() else { return; };
    let region = unsafe { CreateRectRgn(0, 0, width.max(1) as i32, height.max(1) as i32) };
    if region.is_null() { return; }

    let hwnd = handle.hwnd.get() as _;
    if unsafe { SetWindowRgn(hwnd, region, 1) } == 0 {
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

// The taskbar indicator is a native Win32 layered child window, not a WebView.
// This is important: WebView2 child windows can expose their rectangular backing
// surface when Explorer repaints the taskbar (for example when the volume flyout opens).
#[cfg(target_os = "windows")]
#[derive(Clone)]
struct NativeTaskbarWidgetData {
    hwnd: isize,
    taskbar: isize,
    prayer: String,
    prayer_time: String,
    countdown: String,
    is_arabic: bool,
    app_theme: String,
    hovered: bool,
    suppress_hover_until_leave: bool,
}

#[cfg(target_os = "windows")]
impl Default for NativeTaskbarWidgetData {
    fn default() -> Self {
        Self {
            hwnd: 0,
            taskbar: 0,
            prayer: "Prayer".to_string(),
            prayer_time: "--:--".to_string(),
            countdown: "--:--:--".to_string(),
            is_arabic: false,
            app_theme: "dark".to_string(),
            hovered: false,
            suppress_hover_until_leave: false,
        }
    }
}

#[cfg(target_os = "windows")]
static NATIVE_TASKBAR_WIDGET: OnceLock<Mutex<NativeTaskbarWidgetData>> = OnceLock::new();
#[cfg(target_os = "windows")]
static NATIVE_TASKBAR_CLASS_REGISTERED: OnceLock<bool> = OnceLock::new();
#[cfg(target_os = "windows")]
static NATIVE_TASKBAR_OPERATION_LOCK: Mutex<()> = Mutex::new(());
#[cfg(target_os = "windows")]
static TASKBAR_APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

#[cfg(target_os = "windows")]
const NATIVE_TASKBAR_WIDGET_CLASS: &str = "AzkarNativePrayerTaskbarWidget";
#[cfg(target_os = "windows")]
const NATIVE_TASKBAR_TIMER_ID: usize = 41;
#[cfg(target_os = "windows")]
const NATIVE_TASKBAR_CALENDAR_MONITOR_TIMER_ID: usize = 42;
const NATIVE_TASKBAR_HOVER_DELAY_MS: u32 = 1_000;
const NATIVE_TASKBAR_CALENDAR_CLOSE_GRACE_MS: u64 = 100;

#[cfg(target_os = "windows")]
fn native_taskbar_widget_data() -> &'static Mutex<NativeTaskbarWidgetData> {
    NATIVE_TASKBAR_WIDGET.get_or_init(|| Mutex::new(NativeTaskbarWidgetData::default()))
}

#[cfg(target_os = "windows")]
fn native_taskbar_widget_hwnd() -> windows_sys::Win32::Foundation::HWND {
    use windows_sys::Win32::Foundation::HWND;
    let value = native_taskbar_widget_data()
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .hwnd;
    value as HWND
}

#[cfg(target_os = "windows")]
fn register_native_taskbar_widget_class() -> Result<(), String> {
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::UI::WindowsAndMessaging::{RegisterClassW, WNDCLASSW};

    let registered = NATIVE_TASKBAR_CLASS_REGISTERED.get_or_init(|| unsafe {
        let class_name: Vec<u16> = NATIVE_TASKBAR_WIDGET_CLASS
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        let instance = GetModuleHandleW(std::ptr::null());
        let mut class: WNDCLASSW = std::mem::zeroed();
        class.lpfnWndProc = Some(native_taskbar_widget_wndproc);
        class.hInstance = instance;
        class.lpszClassName = class_name.as_ptr();
        RegisterClassW(&class) != 0
    });

    if *registered {
        Ok(())
    } else {
        Err("Windows could not register Azkar's native taskbar widget.".to_string())
    }
}

#[cfg(target_os = "windows")]
fn taskbar_widget_geometry() -> Result<(windows_sys::Win32::Foundation::HWND, i32, i32, i32, i32), String> {
    use windows_sys::Win32::Foundation::{POINT, RECT};
    use windows_sys::Win32::Graphics::Gdi::ScreenToClient;
    use windows_sys::Win32::UI::HiDpi::GetDpiForWindow;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        FindWindowExW, FindWindowW, GetClientRect, GetWindowRect,
    };

    const LOGICAL_WIDTH: i32 = 228;
    const LOGICAL_HEIGHT: i32 = 34;

    let taskbar_class: Vec<u16> = "Shell_TrayWnd".encode_utf16().chain(std::iter::once(0)).collect();
    let tray_class: Vec<u16> = "TrayNotifyWnd".encode_utf16().chain(std::iter::once(0)).collect();
    let taskbar = unsafe { FindWindowW(taskbar_class.as_ptr(), std::ptr::null()) };
    if taskbar.is_null() {
        return Err("Windows taskbar was not found. Azkar will retry automatically.".to_string());
    }

    let mut client: RECT = unsafe { std::mem::zeroed() };
    if unsafe { GetClientRect(taskbar, &mut client) } == 0 {
        return Err("Could not read the Windows taskbar layout.".to_string());
    }

    let tray = unsafe {
        FindWindowExW(taskbar, std::ptr::null_mut(), tray_class.as_ptr(), std::ptr::null())
    };
    let tray_left = if !tray.is_null() {
        let mut rect: RECT = unsafe { std::mem::zeroed() };
        if unsafe { GetWindowRect(tray, &mut rect) } != 0 {
            let mut point = POINT { x: rect.left, y: rect.top };
            unsafe { ScreenToClient(taskbar, &mut point) };
            point.x
        } else {
            client.right
        }
    } else {
        client.right
    };

    let dpi = unsafe { GetDpiForWindow(taskbar) }.max(96);
    let scale = dpi as f64 / 96.0;
    let width = (LOGICAL_WIDTH as f64 * scale).round() as i32;
    let height = (LOGICAL_HEIGHT as f64 * scale).round() as i32;
    let margin = (4.0 * scale).round() as i32;
    let taskbar_width = client.right - client.left;
    let taskbar_height = client.bottom - client.top;

    if taskbar_width <= taskbar_height || taskbar_width < width || taskbar_height < height {
        return Err("Azkar's taskbar indicator requires a horizontal taskbar with enough room.".to_string());
    }

    let x = (tray_left - width - margin).clamp(0, (taskbar_width - width).max(0));
    let y = ((taskbar_height - height) / 2).clamp(0, (taskbar_height - height).max(0));
    Ok((taskbar, x, y, width, height))
}

#[cfg(target_os = "windows")]
fn ensure_native_taskbar_widget() -> Result<(), String> {
    use windows_sys::Win32::Foundation::{GetLastError, SetLastError};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, GetParent, GetWindowLongW, GetWindowRect, IsWindow, SetParent,
        SetWindowLongW, SetWindowPos, SetTimer, ShowWindow, GWL_STYLE, HWND_TOP,
        SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOOWNERZORDER, SWP_NOSIZE, SW_SHOWNOACTIVATE,
        WS_CHILD, WS_CLIPSIBLINGS, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_POPUP,
    };

    let _operation = NATIVE_TASKBAR_OPERATION_LOCK
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    register_native_taskbar_widget_class()?;
    let (taskbar, x, y, width, height) = taskbar_widget_geometry()?;

    let existing = native_taskbar_widget_hwnd();
    let existing_valid = unsafe { !existing.is_null() && IsWindow(existing) != 0 };

    if existing_valid {
        unsafe {
            if GetParent(existing) != taskbar {
                SetParent(existing, taskbar);
            }

            let mut rect: windows_sys::Win32::Foundation::RECT = std::mem::zeroed();
            let mut position_matches = false;
            if GetWindowRect(existing, &mut rect) != 0 {
                let mut point = windows_sys::Win32::Foundation::POINT { x: rect.left, y: rect.top };
                windows_sys::Win32::Graphics::Gdi::ScreenToClient(taskbar, &mut point);
                position_matches = point.x == x
                    && point.y == y
                    && rect.right - rect.left == width
                    && rect.bottom - rect.top == height;
            }

            if position_matches {
                // Reassert only child z-order. Moving/resizing on every pass makes
                // layered windows flicker when taskbar controls are clicked.
                SetWindowPos(
                    existing, HWND_TOP, 0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOOWNERZORDER,
                );
            } else {
                SetWindowPos(existing, HWND_TOP, x, y, width, height, SWP_NOACTIVATE | SWP_NOOWNERZORDER);
            }
        }
        {
            let mut data = native_taskbar_widget_data()
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            data.taskbar = taskbar as isize;
        }
        unsafe { ShowWindow(existing, SW_SHOWNOACTIVATE); }
        render_native_taskbar_widget(existing);
        return Ok(());
    }

    let class_name: Vec<u16> = NATIVE_TASKBAR_WIDGET_CLASS.encode_utf16().chain(std::iter::once(0)).collect();
    let title: Vec<u16> = "Azkar prayer times".encode_utf16().chain(std::iter::once(0)).collect();
    let instance = unsafe { GetModuleHandleW(std::ptr::null()) };
    // Create as a hidden popup first, then switch to WS_CHILD before parenting.
    // This is the reliable Win32 sequence for embedding a layered window into
    // Explorer's taskbar (rather than creating a WebView child surface).
    let hwnd = unsafe {
        CreateWindowExW(
            WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
            class_name.as_ptr(),
            title.as_ptr(),
            WS_POPUP,
            0,
            0,
            width,
            height,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            instance,
            std::ptr::null(),
        )
    };
    if hwnd.is_null() {
        return Err("Windows could not create Azkar's native taskbar indicator.".to_string());
    }

    unsafe {
        let style = GetWindowLongW(hwnd, GWL_STYLE) as u32;
        let child_style = (style & !(WS_POPUP as u32)) | WS_CHILD as u32 | WS_CLIPSIBLINGS as u32;
        SetWindowLongW(hwnd, GWL_STYLE, child_style as i32);
        SetLastError(0);
        let previous_parent = SetParent(hwnd, taskbar);
        let parent_error = GetLastError();
        if previous_parent.is_null() && parent_error != 0 {
            windows_sys::Win32::UI::WindowsAndMessaging::DestroyWindow(hwnd);
            return Err(format!("Windows could not attach Azkar to the taskbar (error {parent_error})."));
        }
        SetWindowPos(
            hwnd, HWND_TOP, x, y, width, height,
            SWP_NOACTIVATE | SWP_NOOWNERZORDER,
        );
    }

    {
        let mut data = native_taskbar_widget_data()
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        data.hwnd = hwnd as isize;
        data.taskbar = taskbar as isize;
    }

    // Upload a fully transparent per-pixel surface before showing the child.
    // Showing it first can expose the class background as a white rectangle.
    render_native_taskbar_widget(hwnd);
    unsafe {
        SetTimer(hwnd, NATIVE_TASKBAR_TIMER_ID, 400, None);
        ShowWindow(hwnd, SW_SHOWNOACTIVATE);
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn destroy_native_taskbar_widget() {
    use windows_sys::Win32::UI::WindowsAndMessaging::{DestroyWindow, IsWindow, KillTimer};
    let _operation = NATIVE_TASKBAR_OPERATION_LOCK
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    let hwnd = {
        let mut data = native_taskbar_widget_data()
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let hwnd = data.hwnd as windows_sys::Win32::Foundation::HWND;
        data.hwnd = 0;
        data.taskbar = 0;
        hwnd
    };
    unsafe {
        if !hwnd.is_null() && IsWindow(hwnd) != 0 {
            KillTimer(hwnd, NATIVE_TASKBAR_TIMER_ID);
            DestroyWindow(hwnd);
        }
    }
}

#[cfg(target_os = "windows")]
fn update_native_taskbar_widget_content(
    prayer: String,
    prayer_time: String,
    countdown: String,
    is_arabic: bool,
    app_theme: String,
) {
    let hwnd = {
        let mut data = native_taskbar_widget_data()
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        data.prayer = prayer.chars().take(24).collect();
        data.prayer_time = prayer_time.chars().take(18).collect();
        data.countdown = countdown.chars().take(16).collect();
        data.is_arabic = is_arabic;
        data.app_theme = if app_theme == "light" { "light" } else { "dark" }.to_string();
        data.hwnd as windows_sys::Win32::Foundation::HWND
    };
    if !hwnd.is_null() {
        render_native_taskbar_widget(hwnd);
    }
}

#[cfg(target_os = "windows")]
fn draw_native_taskbar_text(
    hdc: windows_sys::Win32::Graphics::Gdi::HDC,
    text: &str,
    rect: windows_sys::Win32::Foundation::RECT,
    font_size: i32,
    weight: i32,
    color: u32,
    right_aligned: bool,
    rtl: bool,
) {
    use windows_sys::Win32::Foundation::RECT;
    use windows_sys::Win32::Graphics::Gdi::{CreateFontW, DeleteObject, DrawTextW, SelectObject, SetBkMode, SetTextColor, HGDIOBJ};

    if text.is_empty() { return; }
    let face: Vec<u16> = "Segoe UI".encode_utf16().chain(std::iter::once(0)).collect();
    // Ask GDI for Arabic shaping/fallback on RTL strings while keeping the
    // same Segoe UI family for both Arabic and Latin taskbar text.
    let charset = if rtl { 178 } else { 1 }; // ARABIC_CHARSET / DEFAULT_CHARSET
    let font = unsafe {
        CreateFontW(
            -font_size, 0, 0, 0, weight, 0, 0, 0,
            charset, 4, 0, 4, 0, face.as_ptr(),
        )
    };
    if font.is_null() { return; }

    let old_font = unsafe { SelectObject(hdc, font as HGDIOBJ) };
    unsafe {
        SetBkMode(hdc, 1); // TRANSPARENT
        SetTextColor(hdc, color);
        let wide: Vec<u16> = text.encode_utf16().collect();
        let mut draw_rect: RECT = rect;
        const DT_VCENTER: u32 = 0x00000004;
        const DT_SINGLELINE: u32 = 0x00000020;
        const DT_NOPREFIX: u32 = 0x00000800;
        const DT_END_ELLIPSIS: u32 = 0x00008000;
        const DT_RIGHT: u32 = 0x00000002;
        const DT_RTLREADING: u32 = 0x00020000;
        let mut flags = DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX | DT_END_ELLIPSIS;
        if right_aligned { flags |= DT_RIGHT; }
        if rtl { flags |= DT_RTLREADING; }
        DrawTextW(hdc, wide.as_ptr(), wide.len() as i32, &mut draw_rect, flags);
        SelectObject(hdc, old_font);
        DeleteObject(font as HGDIOBJ);
    }
}

#[cfg(target_os = "windows")]
fn render_native_taskbar_widget(hwnd: windows_sys::Win32::Foundation::HWND) {
    use windows_sys::Win32::Foundation::{POINT, RECT, SIZE};
    use windows_sys::Win32::Graphics::Gdi::{
        CreateCompatibleDC, CreateDIBSection, CreateSolidBrush, DeleteDC, DeleteObject,
        FillRect, GdiFlush, GetDC, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER,
        BLENDFUNCTION, HGDIOBJ,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::UpdateLayeredWindow;

    if hwnd.is_null() { return; }
    let data = native_taskbar_widget_data()
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .clone();

    let dpi = unsafe { windows_sys::Win32::UI::HiDpi::GetDpiForWindow(hwnd) }.max(96);
    let scale = dpi as f64 / 96.0;
    let width = (228.0 * scale).round() as i32;
    let height = (34.0 * scale).round() as i32;
    let white_text = detect_taskbar_text_mode() == "dark";
    let hovered = data.hovered || PRAYER_CALENDAR_OPEN.load(Ordering::Acquire);
    let foreground = if white_text { 0x00FF_FFFF } else { 0x0000_0000 };

    unsafe {
        let screen_dc = GetDC(std::ptr::null_mut());
        if screen_dc.is_null() { return; }

        let mut info: BITMAPINFO = std::mem::zeroed();
        info.bmiHeader = BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width,
            biHeight: -height,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: 0, // BI_RGB
            ..std::mem::zeroed()
        };
        let mut bits: *mut std::ffi::c_void = std::ptr::null_mut();
        let bitmap = CreateDIBSection(
            screen_dc,
            &info,
            0, // DIB_RGB_COLORS
            &mut bits,
            std::ptr::null_mut(),
            0,
        );
        let memory_dc = CreateCompatibleDC(screen_dc);
        ReleaseDC(std::ptr::null_mut(), screen_dc);
        if bitmap.is_null() || memory_dc.is_null() || bits.is_null() {
            if !bitmap.is_null() { DeleteObject(bitmap as HGDIOBJ); }
            if !memory_dc.is_null() { DeleteDC(memory_dc); }
            return;
        }

        let old_bitmap = SelectObject(memory_dc, bitmap as HGDIOBJ);
        let pixels = std::slice::from_raw_parts_mut(bits as *mut u32, (width * height) as usize);
        pixels.fill(if white_text { 0x0000_0000 } else { 0x00FF_FFFF });

        let top = ((height - (21.0 * scale).round() as i32) / 2).max(0);
        let bottom = (top + (21.0 * scale).round() as i32).min(height);
        let padding = (8.0 * scale).round() as i32;
        let gap = (5.0 * scale).round() as i32;
        let divider_x = if data.is_arabic { (96.0 * scale).round() as i32 } else { (134.0 * scale).round() as i32 };
        let divider_brush = CreateSolidBrush(if white_text { 0x006A_6A6A } else { 0x00B5_B5B5 });
        if !divider_brush.is_null() {
            let divider = RECT {
                left: divider_x,
                top: (height - (16.0 * scale).round() as i32) / 2,
                right: divider_x + (1.0 * scale).round() as i32,
                bottom: (height + (16.0 * scale).round() as i32) / 2,
            };
            FillRect(memory_dc, &divider, divider_brush);
            DeleteObject(divider_brush as HGDIOBJ);
        }

        if data.is_arabic {
            draw_native_taskbar_text(
                memory_dc, &data.countdown,
                RECT { left: padding, top, right: divider_x - gap, bottom },
                (15.0 * scale).round() as i32, 550, foreground, false, false,
            );
            draw_native_taskbar_text(
                memory_dc, &data.prayer_time,
                RECT { left: divider_x + gap, top, right: (166.0 * scale).round() as i32, bottom },
                (14.0 * scale).round() as i32, 550, foreground, false, true,
            );
            draw_native_taskbar_text(
                memory_dc, &data.prayer,
                RECT { left: (170.0 * scale).round() as i32, top, right: width - padding, bottom },
                (15.0 * scale).round() as i32, 550, foreground, true, true,
            );
        } else {
            draw_native_taskbar_text(
                memory_dc, &data.prayer,
                RECT { left: padding, top, right: (64.0 * scale).round() as i32, bottom },
                (15.0 * scale).round() as i32, 550, foreground, false, false,
            );
            draw_native_taskbar_text(
                memory_dc, &data.prayer_time,
                RECT { left: (68.0 * scale).round() as i32, top, right: divider_x - gap, bottom },
                (14.0 * scale).round() as i32, 550, foreground, false, false,
            );
            draw_native_taskbar_text(
                memory_dc, &data.countdown,
                RECT { left: divider_x + gap, top, right: width - padding, bottom },
                (15.0 * scale).round() as i32, 550, foreground, false, false,
            );
        }

        // GDI batches drawing to DIB sections. Flush before directly reading
        // their bits so the alpha conversion always sees the completed text.
        GdiFlush();

        // Convert the monochrome antialiased GDI text into premultiplied alpha.
        // Keep alpha=1 across the otherwise transparent rectangle: layered
        // windows pass mouse input through alpha=0 pixels, but the whole taskbar
        // item must remain a reliable hover/click target like a native taskbar button.
        // On hover (or while the calendar is open), composite a restrained rounded
        // selection surface behind the text, matching Windows taskbar hover states.
        // The Windows taskbar hover surface is a low-opacity neutral overlay:
        // about 9% white on a dark taskbar and about 3.5% black on a light one.
        // These values match the subtle selection tile in the supplied weather
        // widget reference rather than drawing an Azkar-colored pill.
        let hover_alpha = if white_text { 24.0f64 } else { 9.0f64 };
        let inset = (1.0 * scale).round() as f64;
        let radius = (6.0 * scale).round().max(3.0) as f64;
        let left = inset;
        let top_edge = inset;
        let right = (width as f64 - inset).max(left + 1.0);
        let bottom_edge = (height as f64 - inset).max(top_edge + 1.0);
        let half_width = (right - left) / 2.0;
        let half_height = (bottom_edge - top_edge) / 2.0;
        let center_x = (right + left) / 2.0;
        let center_y = (bottom_edge + top_edge) / 2.0;
        for y in 0..height {
            for x in 0..width {
                let index = (y * width + x) as usize;
                let pixel = pixels[index];
                let red = (pixel >> 16) & 0xFF;
                let green = (pixel >> 8) & 0xFF;
                let blue = pixel & 0xFF;
                let foreground_alpha = if white_text {
                    red.max(green).max(blue)
                } else {
                    255 - red.min(green).min(blue)
                };

                // Signed-distance rounded rectangle with a half-pixel coverage
                // ramp. This keeps the hover tile's corners smooth at 100% DPI
                // and at fractional display scales.
                let qx = ((x as f64 + 0.5) - center_x).abs() - (half_width - radius);
                let qy = ((y as f64 + 0.5) - center_y).abs() - (half_height - radius);
                let outside_x = qx.max(0.0);
                let outside_y = qy.max(0.0);
                let outside = (outside_x * outside_x + outside_y * outside_y).sqrt();
                let inside = qx.max(qy).min(0.0);
                let signed_distance = outside + inside - radius;
                let coverage = if hovered {
                    (0.5 - signed_distance).clamp(0.0, 1.0)
                } else {
                    0.0
                };
                // Alpha 1 keeps the native item hit-testable while visually
                // transparent when idle. Only the rounded hover tile is visible.
                let background_alpha = if hovered {
                    (hover_alpha * coverage).round() as u32
                } else {
                    0
                };
                let inverse_foreground = 255 - foreground_alpha;
                let output_alpha = foreground_alpha
                    + (background_alpha * inverse_foreground + 127) / 255;
                let background_channel = if white_text { background_alpha } else { 0 };
                let foreground_channel = if white_text { foreground_alpha } else { 0 };
                let output_channel = foreground_channel
                    + (background_channel * inverse_foreground + 127) / 255;
                let output_alpha = output_alpha.max(1);
                pixels[index] = (output_alpha << 24)
                    | (output_channel << 16)
                    | (output_channel << 8)
                    | output_channel;
            }
        }

        let size = SIZE { cx: width, cy: height };
        let source = POINT { x: 0, y: 0 };
        let blend = BLENDFUNCTION {
            BlendOp: 0, // AC_SRC_OVER
            BlendFlags: 0,
            SourceConstantAlpha: 255,
            AlphaFormat: 1, // AC_SRC_ALPHA
        };
        UpdateLayeredWindow(
            hwnd,
            std::ptr::null_mut(),
            std::ptr::null(),
            &size,
            memory_dc,
            &source,
            0, // COLORREF is a u32 alias in windows-sys 0.59.
            &blend,
            2, // ULW_ALPHA
        );

        SelectObject(memory_dc, old_bitmap);
        DeleteObject(bitmap as HGDIOBJ);
        DeleteDC(memory_dc);
    }
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn native_taskbar_widget_wndproc(
    hwnd: windows_sys::Win32::Foundation::HWND,
    message: u32,
    wparam: windows_sys::Win32::Foundation::WPARAM,
    lparam: windows_sys::Win32::Foundation::LPARAM,
) -> windows_sys::Win32::Foundation::LRESULT {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        TrackMouseEvent, TRACKMOUSEEVENT, TME_CANCEL, TME_HOVER, TME_LEAVE,
    };
    use windows_sys::Win32::Graphics::Gdi::{BeginPaint, EndPaint, PAINTSTRUCT};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        DefWindowProcW, KillTimer, SetWindowPos, HWND_TOP,
        MA_NOACTIVATE, SWP_NOMOVE, SWP_NOACTIVATE, SWP_NOOWNERZORDER, SWP_NOSIZE,
        WM_DESTROY, WM_ERASEBKGND, WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MOUSEACTIVATE,
        WM_MOUSEMOVE, WM_PAINT, WM_SETTINGCHANGE, WM_THEMECHANGED,
        WM_DWMCOMPOSITIONCHANGED, WM_DISPLAYCHANGE, WM_DPICHANGED, WM_TIMER,
    };

    // windows-sys 0.59 does not expose these two Win32 message constants
    // from WindowsAndMessaging, so keep their documented Win32 values local.
    const WM_MOUSEHOVER: u32 = 0x02A1;
    const WM_MOUSELEAVE: u32 = 0x02A3;

    match message {
        WM_MOUSEACTIVATE => MA_NOACTIVATE as isize,
        WM_MOUSEMOVE => {
            let entered = {
                let mut data = native_taskbar_widget_data()
                    .lock()
                    .unwrap_or_else(|error| error.into_inner());
                if data.hovered {
                    false
                } else {
                    data.hovered = true;
                    true
                }
            };
            if entered {
                let should_hover_open = {
                    let data = native_taskbar_widget_data()
                        .lock()
                        .unwrap_or_else(|error| error.into_inner());
                    !data.suppress_hover_until_leave && !PRAYER_CALENDAR_OPEN.load(Ordering::Acquire)
                };
                let mut tracking: TRACKMOUSEEVENT = std::mem::zeroed();
                tracking.cbSize = std::mem::size_of::<TRACKMOUSEEVENT>() as u32;
                tracking.dwFlags = if should_hover_open { TME_LEAVE | TME_HOVER } else { TME_LEAVE };
                tracking.hwndTrack = hwnd;
                tracking.dwHoverTime = if should_hover_open { NATIVE_TASKBAR_HOVER_DELAY_MS } else { 0 };
                TrackMouseEvent(&mut tracking);
                render_native_taskbar_widget(hwnd);
            }
            0
        }
        WM_MOUSEHOVER => {
            // Windows sends this once after the pointer remains over the item
            // for the requested hover time. TrackMouseEvent cancels its request
            // after WM_MOUSEHOVER, so re-arm only leave tracking: this prevents
            // repeated calendar openings while the pointer stays still.
            let should_open = {
                let data = native_taskbar_widget_data()
                    .lock()
                    .unwrap_or_else(|error| error.into_inner());
                data.hovered && !data.suppress_hover_until_leave
                    && !PRAYER_CALENDAR_OPEN.load(Ordering::Acquire)
            };
            let mut tracking: TRACKMOUSEEVENT = std::mem::zeroed();
            tracking.cbSize = std::mem::size_of::<TRACKMOUSEEVENT>() as u32;
            tracking.dwFlags = TME_LEAVE;
            tracking.hwndTrack = hwnd;
            tracking.dwHoverTime = 0;
            TrackMouseEvent(&mut tracking);
            if should_open {
                if let Some(app) = TASKBAR_APP_HANDLE.get().cloned() {
                    let theme = native_taskbar_widget_data()
                        .lock()
                        .unwrap_or_else(|error| error.into_inner())
                        .app_theme
                        .clone();
                    tauri::async_runtime::spawn(async move {
                        // The pointer can leave between WM_MOUSEHOVER and this
                        // async task running. Do not flash the flyout open for
                        // a hover that has already ended.
                        if cursor_is_over_taskbar_widget(&app) {
                            let _ = open_prayer_calendar(app, theme, false).await;
                        }
                    });
                }
            }
            0
        }
        WM_MOUSELEAVE => {
            {
                let mut data = native_taskbar_widget_data()
                    .lock()
                    .unwrap_or_else(|error| error.into_inner());
                data.hovered = false;
                data.suppress_hover_until_leave = false;
            }
            // The calendar is a hover flyout of the taskbar widget, not a
            // separately interactive surface. Leaving the widget closes it,
            // even if the pointer happens to cross the popup on its way away.
            dismiss_prayer_calendar_on_widget_leave();
            render_native_taskbar_widget(hwnd);
            0
        }
        WM_LBUTTONDOWN => {
            // A press is a click, not a hover. Cancel only pending hover
            // tracking; keep leave tracking active so selection state remains
            // synchronized until the pointer exits the taskbar item.
            let mut cancel_hover: TRACKMOUSEEVENT = std::mem::zeroed();
            cancel_hover.cbSize = std::mem::size_of::<TRACKMOUSEEVENT>() as u32;
            cancel_hover.dwFlags = TME_CANCEL | TME_HOVER;
            cancel_hover.hwndTrack = hwnd;
            cancel_hover.dwHoverTime = 0;
            TrackMouseEvent(&mut cancel_hover);
            DefWindowProcW(hwnd, message, wparam, lparam)
        }
        WM_LBUTTONUP => {
            let app = TASKBAR_APP_HANDLE.get().cloned();
            let visible = app.as_ref()
                .and_then(|handle| handle.get_webview_window("prayer-calendar"))
                .and_then(|window| window.is_visible().ok())
                .unwrap_or(false);
            let theme = {
                let mut data = native_taskbar_widget_data()
                    .lock()
                    .unwrap_or_else(|error| error.into_inner());
                let currently_open = PRAYER_CALENDAR_OPEN.load(Ordering::Acquire) || visible;
                data.suppress_hover_until_leave = currently_open;
                data.app_theme.clone()
            };
            render_native_taskbar_widget(hwnd);
            if let Some(app) = app {
                tauri::async_runtime::spawn(async move {
                    let _ = toggle_prayer_calendar(app, theme).await;
                });
            }
            0
        }
        WM_PAINT => {
            let mut paint: PAINTSTRUCT = std::mem::zeroed();
            BeginPaint(hwnd, &mut paint);
            EndPaint(hwnd, &paint);
            render_native_taskbar_widget(hwnd);
            0
        }
        WM_ERASEBKGND => 1,
        WM_TIMER if wparam == NATIVE_TASKBAR_CALENDAR_MONITOR_TIMER_ID => {
            // Independent fallback for cases where Explorer swallows
            // WM_MOUSELEAVE for a child embedded in the taskbar. Only the
            // widget itself counts as the hover target; the popup does not.
            let pointer_over_widget = TASKBAR_APP_HANDLE
                .get()
                .map(cursor_is_over_taskbar_widget)
                .unwrap_or(false);
            if !pointer_over_widget {
                dismiss_prayer_calendar_on_widget_leave();
            }
            0
        }
        WM_TIMER if wparam == NATIVE_TASKBAR_TIMER_ID => {
            // TrackMouseEvent normally supplies WM_MOUSELEAVE. This periodic
            // cursor check is a safety net for shell flyouts/reparenting, where
            // a leave message can occasionally be swallowed by Explorer.
            if let Some(app) = TASKBAR_APP_HANDLE.get() {
                let pointer_inside = cursor_is_over_taskbar_widget(app);
                let hover_transition = {
                    let mut data = native_taskbar_widget_data()
                        .lock()
                        .unwrap_or_else(|error| error.into_inner());
                    if pointer_inside != data.hovered {
                        data.hovered = pointer_inside;
                        if !pointer_inside {
                            data.suppress_hover_until_leave = false;
                        }
                        Some((pointer_inside, data.suppress_hover_until_leave))
                    } else {
                        None
                    }
                };
                if let Some((entered, suppressed)) = hover_transition {
                    if entered {
                        // Re-arm both native hover and leave notifications even
                        // when this safety timer detects an entry Explorer did
                        // not deliver as WM_MOUSEMOVE.
                        let should_hover_open = !suppressed && !PRAYER_CALENDAR_OPEN.load(Ordering::Acquire);
                        let mut tracking: TRACKMOUSEEVENT = std::mem::zeroed();
                        tracking.cbSize = std::mem::size_of::<TRACKMOUSEEVENT>() as u32;
                        tracking.dwFlags = if should_hover_open { TME_LEAVE | TME_HOVER } else { TME_LEAVE };
                        tracking.hwndTrack = hwnd;
                        tracking.dwHoverTime = if should_hover_open { NATIVE_TASKBAR_HOVER_DELAY_MS } else { 0 };
                        TrackMouseEvent(&mut tracking);
                    }
                    render_native_taskbar_widget(hwnd);
                }
            }

            // Ask Windows to composite the native child above taskbar controls,
            // but do not move or resize it. Never move/resize on this recovery
            // tick: that would make the widget flicker when shell controls open.
            SetWindowPos(
                hwnd, HWND_TOP, 0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOOWNERZORDER,
            );
            render_native_taskbar_widget(hwnd);
            0
        }
        WM_SETTINGCHANGE | WM_THEMECHANGED | WM_DWMCOMPOSITIONCHANGED | WM_DISPLAYCHANGE | WM_DPICHANGED => {
            render_native_taskbar_widget(hwnd);
            DefWindowProcW(hwnd, message, wparam, lparam)
        }
        WM_DESTROY => {
            KillTimer(hwnd, NATIVE_TASKBAR_TIMER_ID);
            if let Ok(mut data) = native_taskbar_widget_data().lock() {
                if data.hwnd == hwnd as isize {
                    data.hwnd = 0;
                    data.taskbar = 0;
                    data.hovered = false;
                }
            }
            0
        }
        _ => DefWindowProcW(hwnd, message, wparam, lparam),
    }
}

#[tauri::command]
fn set_taskbar_widget(app: AppHandle, enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let _ = TASKBAR_APP_HANDLE.set(app);
        if enabled {
            ensure_native_taskbar_widget()
        } else {
            destroy_native_taskbar_widget();
            Ok(())
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        let _ = enabled;
        Err("The embedded taskbar indicator is currently supported on Windows only.".to_string())
    }
}

#[tauri::command]
fn update_taskbar_widget_content(
    prayer: String,
    prayer_time: String,
    countdown: String,
    is_arabic: bool,
    app_theme: String,
) {
    #[cfg(target_os = "windows")]
    update_native_taskbar_widget_content(prayer, prayer_time, countdown, is_arabic, app_theme);
    #[cfg(not(target_os = "windows"))]
    let _ = (prayer, prayer_time, countdown, is_arabic, app_theme);
}

#[tauri::command]
fn reposition_taskbar_widget() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    { ensure_native_taskbar_widget() }
    #[cfg(not(target_os = "windows"))]
    { Err("The embedded taskbar indicator is currently supported on Windows only.".to_string()) }
}

#[cfg(target_os = "windows")]
fn native_taskbar_widget_rect() -> Option<windows_sys::Win32::Foundation::RECT> {
    use windows_sys::Win32::Foundation::RECT;
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetWindowRect, IsWindow};
    let hwnd = native_taskbar_widget_hwnd();
    if hwnd.is_null() || unsafe { IsWindow(hwnd) } == 0 { return None; }
    let mut rect: RECT = unsafe { std::mem::zeroed() };
    if unsafe { GetWindowRect(hwnd, &mut rect) } != 0 { Some(rect) } else { None }
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
    // Prevent WebView2 from flashing its rectangular redirection surface on transparent windows.
    .no_redirection_bitmap(true)
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
        if let Ok(size) = window.outer_size() {
            apply_square_window_region(&window, size.width, size.height);
        }
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg(target_os = "windows")]
fn prayer_calendar_position(app: &AppHandle) -> (f64, f64) {
    use windows_sys::Win32::Foundation::RECT;
    use windows_sys::Win32::UI::WindowsAndMessaging::{FindWindowW, GetWindowRect};

    let scale = app.primary_monitor().ok().flatten().map(|m| m.scale_factor()).unwrap_or(1.0).max(1.0);
    let monitor = app.primary_monitor().ok().flatten();
    let Some(monitor) = monitor else { return (700.0, 350.0); };
    let monitor_pos = monitor.position();
    let monitor_size = monitor.size();
    let monitor_left = monitor_pos.x;
    let monitor_top = monitor_pos.y;
    let monitor_right = monitor_left + monitor_size.width as i32;
    let monitor_bottom = monitor_top + monitor_size.height as i32;

    let Some(widget_rect) = native_taskbar_widget_rect() else { return (700.0, 350.0); };
    let taskbar_class: Vec<u16> = "Shell_TrayWnd".encode_utf16().chain(std::iter::once(0)).collect();
    let taskbar = unsafe { FindWindowW(taskbar_class.as_ptr(), std::ptr::null()) };
    let mut taskbar_rect = RECT {
        left: monitor_left,
        top: monitor_bottom - 48,
        right: monitor_right,
        bottom: monitor_bottom,
    };
    if !taskbar.is_null() {
        let _ = unsafe { GetWindowRect(taskbar, &mut taskbar_rect) };
    }

    const POPUP_WIDTH: f64 = 356.0;
    const POPUP_HEIGHT: f64 = 424.0;
    let popup_width = (POPUP_WIDTH * scale).round() as i32;
    let popup_height = (POPUP_HEIGHT * scale).round() as i32;
    let gap = (8.0 * scale).round() as i32;
    let mut x = widget_rect.right - popup_width;
    let taskbar_is_top = taskbar_rect.top <= monitor_top + (monitor_bottom - monitor_top) / 2;
    let mut y = if taskbar_is_top {
        taskbar_rect.bottom + gap
    } else {
        taskbar_rect.top - popup_height - gap
    };
    x = x.clamp(monitor_left + gap, (monitor_right - popup_width - gap).max(monitor_left + gap));
    y = y.clamp(monitor_top + gap, (monitor_bottom - popup_height - gap).max(monitor_top + gap));
    (x as f64 / scale, y as f64 / scale)
}

#[cfg(not(target_os = "windows"))]
fn prayer_calendar_position(_app: &AppHandle) -> (f64, f64) {
    (700.0, 350.0)
}

fn prayer_calendar_background(theme: &str) -> Color {
    // Acrylic tint for the calendar flyout. Keep a little transparency so the
    // Windows backdrop material can show through the same way as the tray flyout.
    if theme == "light" {
        Color(247, 243, 234, 190)
    } else {
        Color(18, 22, 30, 182)
    }
}


fn style_prayer_calendar_window(window: &tauri::WebviewWindow, theme: &str) -> Result<(), String> {
    // Use the same native Acrylic backdrop as the system-tray flyout, with a
    // theme-aware tint. The WebView itself stays transparent so DWM can blur
    // the desktop behind the glossy panel.
    let (background, theme_name) = if theme == "light" {
        (prayer_calendar_background("light"), "light")
    } else {
        (prayer_calendar_background("dark"), "dark")
    };
    window.set_background_color(Some(background)).map_err(|error| error.to_string())?;
    let _ = window.set_effects(
        EffectsBuilder::new()
            .effect(Effect::Acrylic)
            .color(background)
            .build(),
    );
    #[cfg(target_os = "windows")]
    if let Ok(size) = window.outer_size() {
        apply_square_window_region(window, size.width, size.height);
    }
    let script = format!(
        "document.documentElement.dataset.theme = '{}'; document.documentElement.style.backgroundColor = 'transparent'; if (document.body) document.body.style.backgroundColor = 'transparent'; const root = document.getElementById('root'); if (root) root.style.backgroundColor = 'transparent'; window.dispatchEvent(new CustomEvent('azkar-prayer-calendar-theme', {{ detail: '{}' }}));",
        theme_name, theme_name
    );
    let _ = window.eval(&script);
    Ok(())
}

static PRAYER_CALENDAR_TOGGLE_BUSY: AtomicBool = AtomicBool::new(false);
static PRAYER_CALENDAR_OPEN: AtomicBool = AtomicBool::new(false);

struct PrayerCalendarToggleGuard;
impl Drop for PrayerCalendarToggleGuard {
    fn drop(&mut self) {
        PRAYER_CALENDAR_TOGGLE_BUSY.store(false, Ordering::Release);
    }
}

#[cfg(target_os = "windows")]
fn cursor_is_over_taskbar_widget(_app: &AppHandle) -> bool {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;
    let Some(rect) = native_taskbar_widget_rect() else { return false; };
    let mut point = POINT { x: 0, y: 0 };
    unsafe { if GetCursorPos(&mut point) == 0 { return false; } }
    point.x >= rect.left && point.x < rect.right && point.y >= rect.top && point.y < rect.bottom
}

#[cfg(not(target_os = "windows"))]
fn cursor_is_over_taskbar_widget(_app: &AppHandle) -> bool { false }

#[cfg(target_os = "windows")]
fn dismiss_prayer_calendar_on_widget_leave() {
    if !PRAYER_CALENDAR_OPEN.swap(false, Ordering::AcqRel) {
        return;
    }

    stop_prayer_calendar_monitor();
    if let Some(app) = TASKBAR_APP_HANDLE.get().cloned() {
        // Hide through Tauri's runtime instead of invoking WebView operations
        // directly from the native Win32 window procedure.
        tauri::async_runtime::spawn(async move {
            close_prayer_calendar(app);
        });
    }
}

#[cfg(not(target_os = "windows"))]
fn dismiss_prayer_calendar_on_widget_leave() {}

#[cfg(target_os = "windows")]
fn start_prayer_calendar_monitor() {
    use windows_sys::Win32::UI::WindowsAndMessaging::SetTimer;
    let hwnd = native_taskbar_widget_hwnd();
    if !hwnd.is_null() {
        unsafe {
            SetTimer(hwnd, NATIVE_TASKBAR_CALENDAR_MONITOR_TIMER_ID, 70, None);
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn start_prayer_calendar_monitor() {}

fn stop_prayer_calendar_monitor() {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::{IsWindow, KillTimer};
        let hwnd = native_taskbar_widget_hwnd();
        if !hwnd.is_null() && unsafe { IsWindow(hwnd) } != 0 {
            unsafe { KillTimer(hwnd, NATIVE_TASKBAR_CALENDAR_MONITOR_TIMER_ID); }
        }
    }
}

async fn open_prayer_calendar(app: AppHandle, theme: String, activate: bool) -> Result<(), String> {
    if PRAYER_CALENDAR_TOGGLE_BUSY.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire).is_err() {
        return Ok(());
    }
    let _toggle_guard = PrayerCalendarToggleGuard;

    let safe_theme = if theme == "light" { "light" } else { "dark" };
    let existing = app.get_webview_window("prayer-calendar");
    let already_open = PRAYER_CALENDAR_OPEN.load(Ordering::Acquire)
        || existing.as_ref().and_then(|window| window.is_visible().ok()).unwrap_or(false);

    if already_open {
        PRAYER_CALENDAR_OPEN.store(true, Ordering::Release);
        start_prayer_calendar_monitor();
        return Ok(());
    }

    let result = (|| -> Result<(), String> {
        if let Some(window) = existing {
            let (x, y) = prayer_calendar_position(&app);
            window.set_position(tauri::LogicalPosition::new(x, y)).map_err(|error| error.to_string())?;
            style_prayer_calendar_window(&window, safe_theme)?;
            present_prayer_calendar(&window, activate)?;
            let _ = window.eval("window.dispatchEvent(new Event('azkar-prayer-calendar-open'));");
            return Ok(());
        }

        let (x, y) = prayer_calendar_position(&app);
        let initial_background = prayer_calendar_background(safe_theme);
        let window = WebviewWindowBuilder::new(
            &app,
            "prayer-calendar",
            tauri::WebviewUrl::App(format!("index.html?prayer-calendar=1&theme={safe_theme}").into()),
        )
        .title("")
        .inner_size(356.0, 424.0)
        .position(x, y)
        .decorations(false)
        .transparent(true)
        .background_color(initial_background)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .visible(false)
        .focused(activate)
        .build()
        .map_err(|error| format!("Could not open the prayer timetable: {error}"))?;

        window.set_decorations(false).map_err(|error| error.to_string())?;
        window.set_resizable(false).map_err(|error| error.to_string())?;
        window.set_shadow(false).map_err(|error| error.to_string())?;
        window.set_skip_taskbar(true).map_err(|error| error.to_string())?;
        style_prayer_calendar_window(&window, safe_theme)?;
        present_prayer_calendar(&window, activate)?;
        Ok(())
    })();

    PRAYER_CALENDAR_OPEN.store(result.is_ok(), Ordering::Release);
    if result.is_ok() {
        start_prayer_calendar_monitor();
    }
    result
}

fn present_prayer_calendar(
    window: &tauri::WebviewWindow,
    activate: bool,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use raw_window_handle::{HasWindowHandle, RawWindowHandle};
        use windows_sys::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_SHOWNOACTIVATE};

        let handle = window.window_handle().map_err(|error| error.to_string())?;
        let RawWindowHandle::Win32(handle) = handle.as_raw() else {
            return Err("Azkar's prayer calendar did not receive a Windows window handle.".to_string());
        };
        unsafe { ShowWindow(handle.hwnd.get() as _, SW_SHOWNOACTIVATE); }
    }
    #[cfg(not(target_os = "windows"))]
    window.show().map_err(|error| error.to_string())?;

    if activate {
        window.set_focus().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn toggle_prayer_calendar(app: AppHandle, theme: String) -> Result<(), String> {
    let already_open = PRAYER_CALENDAR_OPEN.load(Ordering::Acquire)
        || app.get_webview_window("prayer-calendar")
            .and_then(|window| window.is_visible().ok())
            .unwrap_or(false);
    if already_open {
        close_prayer_calendar(app);
        Ok(())
    } else {
        open_prayer_calendar(app, theme, true).await
    }
}

#[tauri::command]
fn set_prayer_calendar_theme(app: AppHandle, theme: String) -> Result<(), String> {
    let safe_theme = if theme == "light" { "light" } else { "dark" };
    if let Some(window) = app.get_webview_window("prayer-calendar") {
        style_prayer_calendar_window(&window, safe_theme)?;
    }
    Ok(())
}

#[tauri::command]
fn close_prayer_calendar(app: AppHandle) {
    PRAYER_CALENDAR_OPEN.store(false, Ordering::Release);
    stop_prayer_calendar_monitor();
    if let Some(window) = app.get_webview_window("prayer-calendar") {
        let _ = window.hide();
    }
    #[cfg(target_os = "windows")]
    {
        let hwnd = native_taskbar_widget_hwnd();
        if !hwnd.is_null() { render_native_taskbar_widget(hwnd); }
    }
}


#[cfg(target_os = "windows")]
fn read_registry_dword(subkey: &str, value_name: &str) -> Option<u32> {
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_CURRENT_USER, KEY_READ,
    };
    const REG_DWORD_TYPE: u32 = 4;

    let subkey: Vec<u16> = subkey.encode_utf16().chain(std::iter::once(0)).collect();
    let value_name: Vec<u16> = value_name.encode_utf16().chain(std::iter::once(0)).collect();
    let mut key: HKEY = std::ptr::null_mut();
    let opened = unsafe { RegOpenKeyExW(HKEY_CURRENT_USER, subkey.as_ptr(), 0, KEY_READ, &mut key) };
    if opened != 0 || key.is_null() { return None; }

    let mut value = 0u32;
    let mut value_type = 0u32;
    let mut bytes = std::mem::size_of::<u32>() as u32;
    let read = unsafe {
        RegQueryValueExW(
            key,
            value_name.as_ptr(),
            std::ptr::null(),
            &mut value_type,
            (&mut value as *mut u32).cast::<u8>(),
            &mut bytes,
        )
    };
    unsafe { RegCloseKey(key); }
    if read == 0 && value_type == REG_DWORD_TYPE && bytes == 4 { Some(value) } else { None }
}

#[cfg(target_os = "windows")]
fn detect_taskbar_text_mode() -> String {
    const PERSONALIZE: &str = r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize";

    // If Windows is configured to paint the taskbar with its accent color,
    // choose text by that actual color's luminance rather than app theme.
    if read_registry_dword(PERSONALIZE, "ColorPrevalence").unwrap_or(0) == 1 {
        let taskbar_accent = read_registry_dword(
            r"Software\Microsoft\Windows\CurrentVersion\Explorer\Accent",
            "AccentColorMenu",
        ).or_else(|| read_registry_dword(r"Software\Microsoft\Windows\DWM", "AccentColor"));
        if let Some(accent) = taskbar_accent {
            // Explorer stores accent colors as AABBGGRR (R in the low byte).
            let red = (accent & 0xFF) as f64 / 255.0;
            let green = ((accent >> 8) & 0xFF) as f64 / 255.0;
            let blue = ((accent >> 16) & 0xFF) as f64 / 255.0;
            let linear = |channel: f64| {
                if channel <= 0.04045 { channel / 12.92 } else { ((channel + 0.055) / 1.055).powf(2.4) }
            };
            let luminance = 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
            let black_contrast = (luminance + 0.05) / 0.05;
            let white_contrast = 1.05 / (luminance + 0.05);
            return if black_contrast >= white_contrast { "light".to_string() } else { "dark".to_string() };
        }
    }

    // SystemUsesLightTheme controls system surfaces such as the taskbar.
    // A missing value defaults to dark system chrome on a fresh Windows profile.
    if read_registry_dword(PERSONALIZE, "SystemUsesLightTheme").unwrap_or(0) == 1 {
        "light".to_string()
    } else {
        "dark".to_string()
    }
}

#[tauri::command]
fn get_taskbar_text_mode() -> String {
    #[cfg(target_os = "windows")]
    { detect_taskbar_text_mode() }
    #[cfg(not(target_os = "windows"))]
    { "dark".to_string() }
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

fn initialize_default_open_on_startup(app: &AppHandle) {
    let config_dir = match app.path().app_config_dir() {
        Ok(path) => path,
        Err(error) => {
            eprintln!("Could not locate Azkar's config directory for startup defaults: {error}");
            return;
        }
    };
    if let Err(error) = std::fs::create_dir_all(&config_dir) {
        eprintln!("Could not create Azkar's config directory: {error}");
        return;
    }

    let marker = config_dir.join("startup-default-initialized-v1");
    if marker.exists() {
        return;
    }

    match set_open_on_startup(app.clone(), true) {
        Ok(()) => {
            if let Err(error) = std::fs::write(&marker, b"enabled-by-default") {
                eprintln!("Could not save Azkar's startup-default marker: {error}");
            }
        }
        Err(error) => eprintln!("Could not enable Azkar startup by default: {error}"),
    }
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
            update_taskbar_widget_content,
            toggle_prayer_calendar,
            set_prayer_calendar_theme,
            close_prayer_calendar,
            get_taskbar_text_mode,
            set_quran_fullscreen,
            reposition_taskbar_widget,
            set_open_on_startup,
            is_open_on_startup,
            quit_app
        ])
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                if window.label() == "prayer-calendar" {
                    PRAYER_CALENDAR_OPEN.store(false, Ordering::Release);
                    stop_prayer_calendar_monitor();
                }
                let _ = window.hide();
            }
            WindowEvent::Focused(false) if window.label() == "tray" => {
                let _ = window.hide();
            }
            WindowEvent::Focused(false) if window.label() == "prayer-calendar" => {
                // Losing focus outside the taskbar widget is another dismissal
                // signal, including when another app is clicked.
                let app = window.app_handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(NATIVE_TASKBAR_CALENDAR_CLOSE_GRACE_MS));
                    // Match the native leave behavior: only hovering the
                    // taskbar widget keeps this flyout visible.
                    if !cursor_is_over_taskbar_widget(&app) {
                        close_prayer_calendar(app);
                    }
                });
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
                } else if window.label() == "main" {
                    if let Ok(scale) = window.scale_factor() {
                        let dimensions = window.outer_size().unwrap_or(*size);
                        apply_rounded_window_region(window, dimensions.width, dimensions.height, scale, 0.0, 19.0);
                    }
                } else if window.label() == "tray" || window.label() == "prayer-calendar" {
                    let dimensions = window.outer_size().unwrap_or(*size);
                    apply_square_window_region(window, dimensions.width, dimensions.height);
                }
            }
            _ => {}
        })
        .setup(|app| {
            #[cfg(target_os = "windows")]
            { let _ = TASKBAR_APP_HANDLE.set(app.handle().clone()); }
            initialize_default_open_on_startup(app.handle());
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
