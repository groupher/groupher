#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    net::{TcpStream, ToSocketAddrs},
    os::unix::process::CommandExt,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    thread,
    time::{Duration, Instant},
};

use tauri::{
    LogicalPosition, Manager, PhysicalPosition, PhysicalSize, RunEvent, TitleBarStyle, Url,
    WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};

const HUB_HOST: &str = "127.0.0.1";
const HUB_PORT: u16 = 4310;
const HUB_URL: &str = "http://127.0.0.1:4310";
const STARTUP_TIMEOUT: Duration = Duration::from_secs(120);
const HEALTH_POLL_INTERVAL: Duration = Duration::from_millis(250);
const MAIN_WIDTH: f64 = 1280.0;
const MAIN_HEIGHT: f64 = 820.0;
const MAIN_MIN_WIDTH: f64 = 960.0;
const MAIN_MIN_HEIGHT: f64 = 640.0;
const SHADOW_LEFT: f64 = 32.0;
const SHADOW_TOP: f64 = 32.0;
const SHADOW_RIGHT: f64 = 32.0;
const SHADOW_BOTTOM: f64 = 52.0;

#[derive(Debug, PartialEq)]
struct ShadowBounds {
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
}

#[derive(Default)]
struct LauncherState {
    child: Mutex<Option<Child>>,
    ensuring: AtomicBool,
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            show_main_window(app);
        }))
        .setup(|app| {
            app.manage(LauncherState::default());

            if app.get_webview_window("main").is_some() {
                ensure_shadow_window(app.handle())?;
            }
            start_hub_ensure(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        let _ = window.hide();
                        hide_shadow_window(window.app_handle());
                    }
                    WindowEvent::Resized(_) | WindowEvent::ScaleFactorChanged { .. } => {
                        if let Some(main_window) = window.app_handle().get_webview_window("main") {
                            if let Err(error) = sync_shadow_window(&main_window) {
                                eprintln!("failed to sync the Dev Hub shadow window: {error}");
                            }
                        }
                    }
                    WindowEvent::Focused(focused) => {
                        if let Some(main_window) = window.app_handle().get_webview_window("main") {
                            if let Err(error) = sync_shadow_window(&main_window) {
                                eprintln!("failed to sync the Dev Hub shadow window: {error}");
                            }
                            if !focused {
                                reconcile_shadow_after_state_transition(main_window);
                            }
                        }
                    }
                    _ => {}
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("failed to build Groupher Dev Hub");

    app.run(|app, event| match event {
        RunEvent::Reopen { .. } => show_main_window(app),
        RunEvent::ExitRequested { .. } | RunEvent::Exit => terminate_owned_hub(app),
        _ => {}
    });
}

fn start_hub_ensure(app: tauri::AppHandle) {
    let state = app.state::<LauncherState>();
    if state.ensuring.swap(true, Ordering::AcqRel) {
        return;
    }

    thread::spawn(move || {
        ensure_hub_is_running(app.clone());
        let state = app.state::<LauncherState>();
        state.ensuring.store(false, Ordering::Release);
    });
}

fn ensure_hub_is_running(app: tauri::AppHandle) {
    if hub_is_ready() {
        open_hub(&app);
        return;
    }

    set_launcher_status(&app, "Starting the production Dev Hub…");
    let log_path = match spawn_hub(&app) {
        Ok(log_path) => log_path,
        Err(error) => {
            fail_launcher(&app, &error);
            return;
        }
    };

    let deadline = Instant::now() + STARTUP_TIMEOUT;
    loop {
        if hub_is_ready() {
            open_hub(&app);
            return;
        }

        if let Some(exit_description) = owned_hub_exit_description(&app) {
            fail_launcher(
                &app,
                &format!(
                    "Dev Hub exited before it became ready ({exit_description}). See {}.",
                    log_path.display()
                ),
            );
            return;
        }

        if Instant::now() >= deadline {
            terminate_owned_hub(&app);
            fail_launcher(
                &app,
                &format!(
                    "Dev Hub did not become ready within 120 seconds. See {}.",
                    log_path.display()
                ),
            );
            return;
        }

        thread::sleep(HEALTH_POLL_INTERVAL);
    }
}

fn spawn_hub(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if hub_is_ready() {
        return Ok(log_path(app));
    }

    let repo_root =
        repo_root().map_err(|error| format!("Could not locate the repository: {error}"))?;
    let makefile = repo_root.join("Makefile");
    if !makefile.is_file() {
        return Err(format!(
            "The configured repository does not contain a Makefile: {}",
            repo_root.display()
        ));
    }

    let log_path = log_path(app);
    let (stdout, stderr) = open_log_files(&log_path)
        .map_err(|error| format!("Could not open {}: {error}", log_path.display()))?;

    let mut command = Command::new("/bin/zsh");
    command
        .args([
            "-lc",
            "exec yarn workspace @groupher/local-dev-hub hub:serve",
        ])
        .current_dir(&repo_root)
        .env("DEV_HUB_OPEN_BROWSER", "false")
        .env("PATH", launcher_path())
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr))
        .process_group(0);

    let child = command
        .spawn()
        .map_err(|error| format!("Could not run make dev in {}: {error}", repo_root.display()))?;

    let state = app.state::<LauncherState>();
    let mut owned_child = state
        .child
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    *owned_child = Some(child);

    Ok(log_path)
}

fn open_log_files(log_path: &Path) -> std::io::Result<(File, File)> {
    if let Some(parent) = log_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let mut stdout = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)?;
    writeln!(
        stdout,
        "\n--- Dev Hub launch {:?} ---",
        std::time::SystemTime::now()
    )?;
    let stderr = stdout.try_clone()?;
    Ok((stdout, stderr))
}

fn repo_root() -> std::io::Result<PathBuf> {
    if let Some(configured_root) = std::env::var_os("GROUPHER_REPO_ROOT") {
        return PathBuf::from(configured_root).canonicalize();
    }

    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .canonicalize()
}

fn launcher_path() -> String {
    let inherited = std::env::var("PATH").unwrap_or_default();
    let defaults = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";
    if inherited.is_empty() {
        defaults.to_owned()
    } else {
        format!("{defaults}:{inherited}")
    }
}

fn log_path(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_log_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("groupher-dev-hub"))
        .join("launcher.log")
}

fn hub_is_ready() -> bool {
    let address = match (HUB_HOST, HUB_PORT).to_socket_addrs() {
        Ok(mut addresses) => match addresses.next() {
            Some(address) => address,
            None => return false,
        },
        Err(_) => return false,
    };

    let mut stream = match TcpStream::connect_timeout(&address, Duration::from_millis(300)) {
        Ok(stream) => stream,
        Err(_) => return false,
    };
    let timeout = Some(Duration::from_millis(500));
    let _ = stream.set_read_timeout(timeout);
    let _ = stream.set_write_timeout(timeout);

    if stream
        .write_all(
            b"GET /api/services HTTP/1.1\r\nHost: 127.0.0.1:4310\r\nConnection: close\r\n\r\n",
        )
        .is_err()
    {
        return false;
    }

    let mut response = Vec::with_capacity(8 * 1024);
    if stream.read_to_end(&mut response).is_err() {
        return false;
    }
    is_hub_health_response(&response)
}

fn is_hub_health_response(response: &[u8]) -> bool {
    let response = String::from_utf8_lossy(response);
    let success = response.starts_with("HTTP/1.1 200") || response.starts_with("HTTP/1.0 200");
    success && response.contains("\"services\"") && response.contains("\"relations\"")
}

fn owned_hub_exit_description(app: &tauri::AppHandle) -> Option<String> {
    let state = app.state::<LauncherState>();
    let mut owned_child = state
        .child
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let child = owned_child.as_mut()?;

    match child.try_wait() {
        Ok(Some(status)) => {
            *owned_child = None;
            Some(status.to_string())
        }
        Ok(None) | Err(_) => None,
    }
}

fn terminate_owned_hub(app: &tauri::AppHandle) {
    let state = app.state::<LauncherState>();
    let child = {
        let mut owned_child = state
            .child
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        owned_child.take()
    };
    let Some(mut child) = child else {
        return;
    };

    let process_group = -(child.id() as i32);
    unsafe {
        libc::kill(process_group, libc::SIGTERM);
    }

    let deadline = Instant::now() + Duration::from_secs(2);
    while Instant::now() < deadline {
        if matches!(child.try_wait(), Ok(Some(_))) {
            return;
        }
        thread::sleep(Duration::from_millis(50));
    }

    unsafe {
        libc::kill(process_group, libc::SIGKILL);
    }
    let _ = child.wait();
}

fn open_hub(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Ok(url) = Url::parse(HUB_URL) else {
        return;
    };

    let _ = window.navigate(url);
    show_window(&window);
}

fn show_main_window(app: &tauri::AppHandle) {
    let window = match app.get_webview_window("main") {
        Some(window) => window,
        None => match create_main_window(app) {
            Ok(window) => window,
            Err(error) => {
                eprintln!("failed to recreate the Dev Hub window: {error}");
                return;
            }
        },
    };

    if let Err(error) = ensure_shadow_window(app) {
        eprintln!("failed to prepare the Dev Hub shadow window: {error}");
    }
    show_window(&window);
}

fn create_main_window(app: &tauri::AppHandle) -> tauri::Result<WebviewWindow> {
    let hub_ready = hub_is_ready();
    let url = if hub_ready {
        WebviewUrl::External(Url::parse(HUB_URL).expect("HUB_URL must be valid"))
    } else {
        WebviewUrl::App("index.html".into())
    };

    let window = WebviewWindowBuilder::new(app, "main", url)
        .title("Groupher Dev Hub")
        .transparent(true)
        .shadow(false)
        .title_bar_style(TitleBarStyle::Overlay)
        .hidden_title(true)
        .traffic_light_position(LogicalPosition::new(16.0, 16.0))
        .inner_size(MAIN_WIDTH, MAIN_HEIGHT)
        .min_inner_size(MAIN_MIN_WIDTH, MAIN_MIN_HEIGHT)
        .center()
        .build()?;

    if !hub_ready {
        start_hub_ensure(app.clone());
    }

    Ok(window)
}

fn show_window(window: &WebviewWindow) {
    let _ = window.unminimize();
    let _ = window.show();
    if let Err(error) = sync_shadow_window(window) {
        eprintln!("failed to show the Dev Hub shadow window: {error}");
    }
    let _ = window.set_focus();
}

fn ensure_shadow_window(app: &tauri::AppHandle) -> tauri::Result<WebviewWindow> {
    let shadow_window = match app.get_webview_window("shadow") {
        Some(window) => window,
        None => WebviewWindowBuilder::new(app, "shadow", WebviewUrl::App("shadow.html".into()))
            .title("Groupher Dev Hub Shadow")
            .inner_size(
                MAIN_WIDTH + SHADOW_LEFT + SHADOW_RIGHT,
                MAIN_HEIGHT + SHADOW_TOP + SHADOW_BOTTOM,
            )
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .resizable(false)
            .maximizable(false)
            .minimizable(false)
            .closable(false)
            .focusable(false)
            .skip_taskbar(true)
            .visible(false)
            .build()?,
    };

    shadow_window.set_ignore_cursor_events(true)?;
    Ok(shadow_window)
}

#[cfg(target_os = "macos")]
fn attach_shadow_window(
    main_window: &WebviewWindow,
    shadow_window: &WebviewWindow,
) -> tauri::Result<()> {
    use objc2_app_kit::{NSWindow, NSWindowOrderingMode};

    let dispatcher = main_window.clone();
    let main_window = main_window.clone();
    let shadow_window = shadow_window.clone();

    dispatcher.run_on_main_thread(move || {
        let attach = || -> tauri::Result<()> {
            let main_pointer = main_window.ns_window()?;
            let shadow_pointer = shadow_window.ns_window()?;
            let main_ns_window = unsafe { &*main_pointer.cast::<NSWindow>() };
            let shadow_ns_window = unsafe { &*shadow_pointer.cast::<NSWindow>() };

            if shadow_ns_window
                .parentWindow()
                .is_some_and(|parent| std::ptr::eq(parent.as_ref(), main_ns_window))
            {
                return Ok(());
            }

            unsafe {
                main_ns_window
                    .addChildWindow_ordered(shadow_ns_window, NSWindowOrderingMode::Below);
            }
            Ok(())
        };

        if let Err(error) = attach() {
            eprintln!("failed to attach the Dev Hub shadow window: {error}");
        }
    })
}

#[cfg(not(target_os = "macos"))]
fn attach_shadow_window(
    _main_window: &WebviewWindow,
    _shadow_window: &WebviewWindow,
) -> tauri::Result<()> {
    Ok(())
}

fn sync_shadow_window(main_window: &WebviewWindow) -> tauri::Result<()> {
    let Some(shadow_window) = main_window.app_handle().get_webview_window("shadow") else {
        return Ok(());
    };
    let fills_screen = main_window.is_maximized()? || main_window.is_fullscreen()?;
    let _ = main_window.eval(format!(
        "document.documentElement.classList.toggle('window-fills-screen', {fills_screen})"
    ));

    if !main_window.is_visible()? || main_window.is_minimized()? || fills_screen {
        shadow_window.hide()?;
        return Ok(());
    }

    let bounds = shadow_bounds(
        main_window.outer_position()?,
        main_window.outer_size()?,
        main_window.scale_factor()?,
    );
    shadow_window.set_position(bounds.position)?;
    shadow_window.set_size(bounds.size)?;
    shadow_window.show()?;
    attach_shadow_window(main_window, &shadow_window)?;
    Ok(())
}

fn hide_shadow_window(app: &tauri::AppHandle) {
    if let Some(shadow_window) = app.get_webview_window("shadow") {
        let _ = shadow_window.hide();
    }
}

fn reconcile_shadow_after_state_transition(main_window: WebviewWindow) {
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(100));
        if let Err(error) = sync_shadow_window(&main_window) {
            eprintln!("failed to reconcile the Dev Hub shadow window: {error}");
        }
    });
}

fn shadow_bounds(
    main_position: PhysicalPosition<i32>,
    main_size: PhysicalSize<u32>,
    scale_factor: f64,
) -> ShadowBounds {
    let left = (SHADOW_LEFT * scale_factor).round() as i32;
    let top = (SHADOW_TOP * scale_factor).round() as i32;
    let right = (SHADOW_RIGHT * scale_factor).round() as u32;
    let bottom = (SHADOW_BOTTOM * scale_factor).round() as u32;

    ShadowBounds {
        position: PhysicalPosition::new(main_position.x - left, main_position.y - top),
        size: PhysicalSize::new(
            main_size
                .width
                .saturating_add(left as u32)
                .saturating_add(right),
            main_size
                .height
                .saturating_add(top as u32)
                .saturating_add(bottom),
        ),
    }
}

fn set_launcher_status(app: &tauri::AppHandle, message: &str) {
    eval_launcher(app, "setStatus", message);
}

fn fail_launcher(app: &tauri::AppHandle, message: &str) {
    show_main_window(app);
    eval_launcher(app, "fail", message);
}

fn eval_launcher(app: &tauri::AppHandle, method: &str, message: &str) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Ok(message) = serde_json::to_string(message) else {
        return;
    };
    let _ = window.eval(format!("window.__DEV_HUB_LAUNCHER__?.{method}({message})"));
}

#[cfg(test)]
mod tests {
    use super::{is_hub_health_response, shadow_bounds, ShadowBounds};
    use tauri::{PhysicalPosition, PhysicalSize};

    #[test]
    fn accepts_a_dev_hub_snapshot() {
        let response =
            b"HTTP/1.1 200 OK\r\ncontent-type: application/json\r\n\r\n{\"services\":[],\"relations\":[]}";

        assert!(is_hub_health_response(response));
    }

    #[test]
    fn rejects_an_unrelated_server_on_the_same_port() {
        let response = b"HTTP/1.1 200 OK\r\ncontent-type: text/html\r\n\r\n<html>hello</html>";

        assert!(!is_hub_health_response(response));
    }

    #[test]
    fn rejects_non_successful_responses() {
        let response =
            b"HTTP/1.1 503 Service Unavailable\r\n\r\n{\"services\":[],\"relations\":[]}";

        assert!(!is_hub_health_response(response));
    }

    #[test]
    fn expands_the_shadow_around_the_visible_window_at_retina_scale() {
        let bounds = shadow_bounds(
            PhysicalPosition::new(400, 240),
            PhysicalSize::new(2560, 1640),
            2.0,
        );

        assert_eq!(
            bounds,
            ShadowBounds {
                position: PhysicalPosition::new(336, 176),
                size: PhysicalSize::new(2688, 1808),
            }
        );
    }
}
