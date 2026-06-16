// Tauri entrypoint. File open/save is handled on the frontend via the dialog + fs
// plugins (see src/lib/tauriFiles.ts), so the Rust side just registers them.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
