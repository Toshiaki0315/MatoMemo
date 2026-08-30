//! MatoMemo の Tauri シェル。
//!
//! アプリケーションのロジックはすべてフロントエンド (TypeScript) 側にあり、
//! Rust 側はウィンドウとファイルアクセス権限のホストに徹する。
//! そのため独自の `#[tauri::command]` は定義していない。

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
