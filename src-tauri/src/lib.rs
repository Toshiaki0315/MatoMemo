//! MatoMemo の Tauri シェル。
//!
//! アプリケーションのロジックはすべてフロントエンド (TypeScript) 側にあり、
//! Rust 側はウィンドウとファイルアクセス権限のホストに徹する。
//! 例外はファイルの安全な保存で、一時ファイルへの書き込みと rename を
//! 1 つの操作として行う必要があるため、ここでコマンドとして提供する。

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

/// 保存先と同じディレクトリの一時ファイル名。
/// 別のボリュームだと rename が使えないため、必ず同じディレクトリに置く。
fn temporary_path(target: &Path) -> PathBuf {
    let mut name = target.as_os_str().to_owned();
    name.push(".tmp");
    PathBuf::from(name)
}

/// テキストを一時ファイルに書き切ってから rename で保存先に置き換える。
///
/// 保存先を直接開いて書くと、途中で失敗したときに元の内容まで失われる
/// （ファイルは開いた時点で空になるため）。rename は同じディレクトリ内なら
/// 原子的なので、失敗しても保存先には直前の内容がそのまま残る。
#[tauri::command]
fn write_text_file_atomic(path: String, contents: String) -> Result<(), String> {
    let target = Path::new(&path);
    let temporary = temporary_path(target);
    let result = (|| -> std::io::Result<()> {
        let mut file = fs::File::create(&temporary)?;
        file.write_all(contents.as_bytes())?;
        // rename の前にディスクへ書き切る。クラッシュ直後に
        // 「rename 済みなのに中身が空」という状態を作らないため。
        file.sync_all()?;
        fs::rename(&temporary, target)
    })();
    result.map_err(|error| {
        // 失敗した一時ファイルは残しても役に立たないので片付ける
        let _ = fs::remove_file(&temporary);
        error.to_string()
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![write_text_file_atomic])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
