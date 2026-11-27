#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    collections::{BTreeMap, HashSet},
    ffi::OsString,
    io::{Error, ErrorKind},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::Mutex,
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
    tabs: Mutex<BTreeMap<String, serde_json::Value>>,
    ensuring: Mutex<HashSet<String>>,
    error: Mutex<Option<String>>,
    requested_focus: Mutex<Option<String>>,
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _| {
            show_main_window(app);
            match explicit_repo_root(args.into_iter().skip(1).map(OsString::from)) {
                Ok(Some(root)) => start_hub_ensure(app.clone(), root),
                Ok(None) => {}
                Err(error) => desktop_error(app, &error.to_string()),
            }
        }))
        .setup(|app| {
            app.manage(LauncherState::default());
            match repo_root() {
                Ok(root) => {
                    start_hub_ensure(app.handle().clone(), root.clone());
                    discover_running_hubs(app.handle().clone(), root);
                }
                Err(error) => desktop_error(app.handle(), &error.to_string()),
            }
            Ok(())
        })
        .on_page_load(|webview, payload| {
            if webview.label() == "main"
                && payload.event() == tauri::webview::PageLoadEvent::Finished
            {
                let focus = webview
                    .app_handle()
                    .try_state::<LauncherState>()
                    .and_then(|state| {
                        state
                            .requested_focus
                            .lock()
                            .unwrap_or_else(|e| e.into_inner())
                            .clone()
                    });
                sync_tabs(webview.app_handle(), focus.as_deref());
            }
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

fn start_hub_ensure(app: tauri::AppHandle, requested_root: PathBuf) {
    let root = match requested_root.canonicalize() {
        Ok(root) => root,
        Err(error) => {
            desktop_error(
                &app,
                &format!("Could not locate {}: {error}", requested_root.display()),
            );
            return;
        }
    };
    let key = root.to_string_lossy().into_owned();
    let state = app.state::<LauncherState>();
    *state
        .requested_focus
        .lock()
        .unwrap_or_else(|e| e.into_inner()) = Some(key.clone());
    *state
        .error
        .lock()
        .unwrap_or_else(|error| error.into_inner()) = None;
    let mut ensuring = state
        .ensuring
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    if !ensuring.insert(key.clone()) {
        drop(ensuring);
        sync_tabs(&app, Some(&key));
        return;
    }
    drop(ensuring);
    {
        let mut tabs = state.tabs.lock().unwrap_or_else(|error| error.into_inner());
        tabs.entry(key.clone())
            .or_insert_with(|| tab_value(&root, "loading", None, None));
    }
    sync_tabs(&app, Some(&key));

    thread::spawn(move || {
        let result = ensure_hub(&root);
        let tab = match result {
            Ok(url) => tab_value(&root, "ready", Some(url.as_str()), None),
            Err(error) => tab_value(&root, "error", None, Some(&error)),
        };
        let state = app.state::<LauncherState>();
        state
            .tabs
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .insert(key.clone(), tab);
        state
            .ensuring
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .remove(&key);
        sync_tabs(&app, None);
    });
}

fn ensure_hub(root: &Path) -> Result<Url, String> {
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
    read_hub(root)
}

fn read_hub(root: &Path) -> Result<Url, String> {
    let output = Command::new("/bin/zsh")
        .args(["-lc", "exec pnpm --silent devhub identity --page"])
        .current_dir(root)
        .env("PATH", launcher_path())
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("Could not verify Dev Hub in {}: {error}", root.display()))?;
    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(if message.is_empty() {
            format!("Dev Hub page verification failed ({})", output.status)
        } else {
            message
        });
    }
    let identity: serde_json::Value =
        serde_json::from_slice(&output.stdout).map_err(|_| "Dev Hub returned invalid identity.")?;
    let mut url = parse_hub_url(&String::from_utf8_lossy(&output.stdout), root)?;
    let instance = identity["instanceId"]
        .as_str()
        .filter(|value| !value.is_empty())
        .ok_or("Dev Hub returned no instance identity.")?;
    let root = root.to_str().ok_or("Checkout path is not valid UTF-8.")?;
    url.query_pairs_mut()
        .append_pair("devhubInstance", instance)
        .append_pair("devhubRoot", root);
    Ok(url)
}

fn discover_running_hubs(app: tauri::AppHandle, root: PathBuf) {
    thread::spawn(move || {
        let output = Command::new("/bin/zsh")
            .args(["-lc", "exec pnpm --silent devhub doctor --json"])
            .current_dir(&root)
            .env("PATH", launcher_path())
            .stdin(Stdio::null())
            .output();
        let Ok(output) = output else { return };
        if !output.status.success() {
            return;
        }
        let Ok(report) = serde_json::from_slice::<serde_json::Value>(&output.stdout) else {
            return;
        };
        let Some(environments) = report["environments"].as_array() else {
            return;
        };
        for environment in environments {
            if environment["reportedPhase"] != "running" {
                continue;
            }
            let Some(path) = environment["root"].as_str() else {
                continue;
            };
            let candidate = PathBuf::from(path);
            if candidate == root || !candidate.is_absolute() {
                continue;
            }
            let result = if environment["ownership"] == "verified" {
                match candidate.canonicalize() {
                    Ok(actual) if actual == candidate => read_hub(&candidate),
                    _ => Err("Checkout path cannot be verified.".to_owned()),
                }
            } else {
                Err("Checkout ownership cannot be verified.".to_owned())
            };
            let tab = match result {
                Ok(url) => tab_value(&candidate, "ready", Some(url.as_str()), None),
                Err(error) => tab_value(&candidate, "error", None, Some(&error)),
            };
            let key = candidate.to_string_lossy().into_owned();
            let state = app.state::<LauncherState>();
            let mut tabs = state.tabs.lock().unwrap_or_else(|error| error.into_inner());
            tabs.entry(key).or_insert(tab);
        }
        sync_tabs(&app, None);
    });
}

fn parse_hub_url(output: &str, expected_root: &Path) -> Result<Url, String> {
    let start = output.find('{').ok_or("Dev Hub returned no identity.")?;
    let identity: serde_json::Value =
        serde_json::from_str(&output[start..]).map_err(|_| "Dev Hub returned invalid identity.")?;
    if identity["apiVersion"] != 1 || identity["mode"] != "full" {
        return Err("This checkout is not running a full Dev Hub.".to_owned());
    }
    let root = identity["repoRoot"]
        .as_str()
        .ok_or("Dev Hub returned no checkout identity.")?;
    if Path::new(root) != expected_root {
        return Err("Dev Hub returned a different checkout identity.".to_owned());
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
    if let Some(root) = explicit_repo_root(std::env::args_os().skip(1))? {
        return root.canonicalize();
    }
    if let Some(configured_root) = std::env::var_os("GROUPHER_REPO_ROOT") {
        return PathBuf::from(configured_root).canonicalize();
    }
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .canonicalize()
}

fn explicit_repo_root(
    args: impl IntoIterator<Item = OsString>,
) -> std::io::Result<Option<PathBuf>> {
    let mut args = args.into_iter();
    let mut root = None;
    while let Some(arg) = args.next() {
        if arg == "--repo-root" {
            if root.is_some() {
                return Err(Error::new(ErrorKind::InvalidInput, "duplicate --repo-root"));
            }
            let value = args
                .next()
                .ok_or_else(|| Error::new(ErrorKind::InvalidInput, "missing --repo-root path"))?;
            let path = PathBuf::from(value);
            if !path.is_absolute() {
                return Err(Error::new(
                    ErrorKind::InvalidInput,
                    "--repo-root must be an absolute path",
                ));
            }
            root = Some(path);
        }
    }
    Ok(root)
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
    let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
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

fn tab_value(
    root: &Path,
    status: &str,
    url: Option<&str>,
    error: Option<&str>,
) -> serde_json::Value {
    let name = root
        .file_name()
        .unwrap_or(root.as_os_str())
        .to_string_lossy();
    let branch = Command::new("git")
        .args(["branch", "--show-current"])
        .current_dir(root)
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_owned())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "detached".to_owned());
    serde_json::json!({"root": root.to_string_lossy(), "name": name, "branch": branch, "status": status, "url": url, "error": error})
}

fn sync_tabs(app: &tauri::AppHandle, focus: Option<&str>) {
    let Some(state) = app.try_state::<LauncherState>() else {
        return;
    };
    let tabs: Vec<_> = state
        .tabs
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .values()
        .cloned()
        .collect();
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let error = state
        .error
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .clone();
    let payload = serde_json::json!({"tabs": tabs, "focus": focus, "error": error});
    let _ = window.eval(format!("window.__DEV_HUB_DESKTOP__?.sync({payload})"));
}

fn desktop_error(app: &tauri::AppHandle, message: &str) {
    if let Some(state) = app.try_state::<LauncherState>() {
        *state
            .error
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = Some(message.to_owned());
        sync_tabs(app, None);
    }
}

#[cfg(test)]
mod tests {
    use super::{explicit_repo_root, parse_hub_url};
    use std::ffi::OsString;
    use std::path::Path;

    #[test]
    fn accepts_only_a_verified_full_local_hub() {
        let root = Path::new("/checkout/a");
        let output = r#"{"apiVersion":1,"mode":"full","repoRoot":"/checkout/a","apiOrigin":"http://127.0.0.1:4312"}"#;
        assert_eq!(parse_hub_url(output, root).unwrap().port(), Some(4312));
        assert!(parse_hub_url(&output.replace("4312", "4310"), root).is_err());
        assert!(parse_hub_url(&output.replace("127.0.0.1", "example.com"), root).is_err());
        assert!(parse_hub_url(&output.replace("full", "control-only"), root).is_err());
        assert!(parse_hub_url(&output.replace("/checkout/a", "/checkout/b"), root).is_err());
        assert!(parse_hub_url("{}", root).is_err());
    }

    #[test]
    fn parses_only_one_explicit_absolute_checkout() {
        let args = |values: &[&str]| values.iter().map(OsString::from).collect::<Vec<_>>();
        assert_eq!(
            explicit_repo_root(args(&["--repo-root", "/checkout/b"]))
                .unwrap()
                .unwrap(),
            Path::new("/checkout/b")
        );
        assert!(explicit_repo_root(args(&["--repo-root"])).is_err());
        assert!(explicit_repo_root(args(&["--repo-root", "relative"])).is_err());
        assert!(explicit_repo_root(args(&[
            "--repo-root",
            "/checkout/a",
            "--repo-root",
            "/checkout/b"
        ]))
        .is_err());
        assert!(explicit_repo_root(args(&[])).unwrap().is_none());
    }
}
