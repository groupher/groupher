#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    thread,
};

use tauri::{
    LogicalPosition, Manager, RunEvent, TitleBarStyle, Url, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};

const MAIN_WIDTH: f64 = 1280.0;
const MAIN_HEIGHT: f64 = 820.0;
const MAIN_MIN_WIDTH: f64 = 960.0;
const MAIN_MIN_HEIGHT: f64 = 640.0;

#[derive(Default)]
struct LauncherState {
    hub_url: Mutex<Option<Url>>,
    ensuring: AtomicBool,
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            show_main_window(app)
        }))
        .setup(|app| {
            app.manage(LauncherState::default());
            start_hub_ensure(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("failed to build Groupher Dev Hub");

    app.run(|app, event| {
        if let RunEvent::Reopen { .. } = event {
            show_main_window(app);
        }
    });
}

fn start_hub_ensure(app: tauri::AppHandle) {
    let state = app.state::<LauncherState>();
    if state.ensuring.swap(true, Ordering::AcqRel) {
        return;
    }

    thread::spawn(move || {
        set_launcher_status(&app, "Starting the Dev Hub…");
        match ensure_hub() {
            Ok(url) => {
                let state = app.state::<LauncherState>();
                *state
                    .hub_url
                    .lock()
                    .unwrap_or_else(|error| error.into_inner()) = Some(url.clone());
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.navigate(url);
                    show_window(&window);
                }
            }
            Err(error) => fail_launcher(&app, &error),
        }
        app.state::<LauncherState>()
            .ensuring
            .store(false, Ordering::Release);
    });
}

fn ensure_hub() -> Result<Url, String> {
    let root = repo_root().map_err(|error| format!("Could not locate the repository: {error}"))?;
    let output = Command::new("/bin/zsh")
        .args(["-lc", "exec pnpm --silent devhub up"])
        .current_dir(&root)
        .env("PATH", launcher_path())
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("Could not run Dev Hub in {}: {error}", root.display()))?;

    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(if message.is_empty() {
            format!("Dev Hub startup failed ({})", output.status)
        } else {
            message
        });
    }
    parse_hub_url(&String::from_utf8_lossy(&output.stdout))
}

fn parse_hub_url(output: &str) -> Result<Url, String> {
    let start = output.find('{').ok_or("Dev Hub returned no identity.")?;
    let identity: serde_json::Value =
        serde_json::from_str(&output[start..]).map_err(|_| "Dev Hub returned invalid identity.")?;
    if identity["apiVersion"] != 1 || identity["mode"] != "full" {
        return Err("This checkout is not running a full Dev Hub.".to_owned());
    }
    let raw = identity["apiOrigin"]
        .as_str()
        .ok_or("Dev Hub returned no origin.")?;
    let url = Url::parse(raw).map_err(|_| "Dev Hub returned an invalid origin.")?;
    if url.scheme() != "http"
        || url.host_str() != Some("127.0.0.1")
        || !matches!(url.port(), Some(4312..=4339))
        || url.path() != "/"
        || url.query().is_some()
        || url.fragment().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("Dev Hub returned an unexpected origin.".to_owned());
    }
    Ok(url)
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
    show_window(&window);
}

fn create_main_window(app: &tauri::AppHandle) -> tauri::Result<WebviewWindow> {
    let saved = app
        .state::<LauncherState>()
        .hub_url
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .clone();
    let url = match saved {
        Some(url) => WebviewUrl::External(url),
        None => WebviewUrl::App("index.html".into()),
    };
    let window = WebviewWindowBuilder::new(app, "main", url)
        .title("Groupher Dev Hub")
        .transparent(false)
        .shadow(true)
        .title_bar_style(TitleBarStyle::Overlay)
        .hidden_title(true)
        .traffic_light_position(LogicalPosition::new(16.0, 16.0))
        .inner_size(MAIN_WIDTH, MAIN_HEIGHT)
        .min_inner_size(MAIN_MIN_WIDTH, MAIN_MIN_HEIGHT)
        .center()
        .build()?;
    Ok(window)
}

fn show_window(window: &WebviewWindow) {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
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
    use super::parse_hub_url;

    #[test]
    fn accepts_only_a_verified_full_local_hub() {
        let output = r#"{"apiVersion":1,"mode":"full","apiOrigin":"http://127.0.0.1:4312"}"#;
        assert_eq!(parse_hub_url(output).unwrap().port(), Some(4312));
        assert!(parse_hub_url(&output.replace("4312", "4310")).is_err());
        assert!(parse_hub_url(&output.replace("127.0.0.1", "example.com")).is_err());
        assert!(parse_hub_url(&output.replace("full", "control-only")).is_err());
        assert!(parse_hub_url("{}").is_err());
    }
}
