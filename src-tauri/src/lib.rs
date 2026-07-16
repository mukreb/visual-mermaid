// Tauri entrypoint. File open/save is handled on the frontend via the dialog + fs
// plugins (see src/lib/tauriFiles.ts). The Rust side registers those plugins and,
// for macOS "Open With" / double-click in Finder, captures the RunEvent::Opened
// file URLs into shared state that the frontend drains: once at launch
// (take_opened_files) and again whenever an "open-file" signal fires while the app
// is already running.

use std::sync::Mutex;

/// File paths macOS asked us to open (Finder double-click / "Open With"), buffered
/// until the frontend drains them. Buffering matters at cold start: the Opened event
/// can arrive before the webview is ready to receive an emitted event.
#[derive(Default)]
struct PendingOpen(Mutex<Vec<String>>);

/// Drain and return any pending file paths. The atomic take means a path is handed
/// out exactly once, so the launch-time drain and the "open-file" listener can never
/// double-open the same file.
#[tauri::command]
fn take_opened_files(state: tauri::State<'_, PendingOpen>) -> Vec<String> {
    match state.0.lock() {
        Ok(mut guard) => std::mem::take(&mut *guard),
        Err(_) => Vec::new(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(PendingOpen::default())
        .invoke_handler(tauri::generate_handler![take_opened_files])
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(|_app_handle, _event| {
        // RunEvent::Opened is a macOS/iOS/Android-only variant (a file was opened
        // with the app). Gate the handler so the closure still compiles elsewhere.
        #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
        handle_opened(_app_handle, _event);
    });
}

/// Buffer any file paths from a RunEvent::Opened and nudge the frontend to drain.
#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
fn handle_opened(app_handle: &tauri::AppHandle, event: tauri::RunEvent) {
    use tauri::{Emitter, Manager};

    let tauri::RunEvent::Opened { urls } = event else {
        return;
    };
    let paths: Vec<String> = urls
        .iter()
        .filter_map(|url| url.to_file_path().ok())
        .map(|path| path.to_string_lossy().into_owned())
        .collect();
    if paths.is_empty() {
        return;
    }
    if let Ok(mut guard) = app_handle.state::<PendingOpen>().0.lock() {
        guard.extend(paths);
    }
    // Nudge a running frontend to drain; harmless if nothing is listening yet
    // (the launch-time drain picks the files up instead).
    let _ = app_handle.emit("open-file", ());
}
