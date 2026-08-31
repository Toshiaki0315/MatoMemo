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

/// Space によるパン操作中か。キーリピートを握りつぶす判定に使う。
#[cfg(target_os = "macos")]
static PAN_KEY_HELD: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

/// Space によるパン操作の開始・終了を受け取る。
///
/// macOS はキーが押されるたびにカーソルを「マウスが動くまで」隠す。
/// 開始時は、押した瞬間の隠蔽を打ち消してカーソルを見え続けさせる。
/// 押している間のキーリピートはイベントモニタ側で握りつぶす
/// （`install_space_repeat_filter`）ため、繰り返し隠されることはない。
#[tauri::command]
fn set_pan_key_held(app: tauri::AppHandle, held: bool) {
    #[cfg(target_os = "macos")]
    {
        PAN_KEY_HELD.store(held, std::sync::atomic::Ordering::Relaxed);
        if held {
            unhide_cursor(&app);
            // 打ち消しがキーイベントの処理より先に走ると、その後の隠蔽に
            // 負けてしまう。処理が済んだ頃にもう一度打ち消す。
            let delayed = app.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(60));
                unhide_cursor(&delayed);
            });
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        let _ = held;
    }
}

/// キー入力による「マウスが動くまで隠す」状態を打ち消す。
#[cfg(target_os = "macos")]
fn unhide_cursor(app: &tauri::AppHandle) {
    let _ = app.run_on_main_thread(|| {
        objc2_app_kit::NSCursor::setHiddenUntilMouseMoves(false);
    });
}

/// パン操作中の Space のキーリピートを握りつぶすイベントモニタを付ける。
///
/// リピートのたびに macOS がカーソルを隠すため、打ち消しでは
/// 「隠す → 出す」の点滅になってしまう。リピートを WebView に渡さなければ
/// 隠されること自体がなくなる。パン操作中でなければ（テキスト入力中の
/// Space 連打など）そのまま通す。メインスレッドで呼ぶこと。
#[cfg(target_os = "macos")]
fn install_space_repeat_filter() {
    use objc2_app_kit::{NSEvent, NSEventMask};

    /// Space のキーコード (kVK_Space)。
    const SPACE_KEY_CODE: u16 = 49;

    let handler = block2::RcBlock::new(
        |event: std::ptr::NonNull<NSEvent>| -> *mut NSEvent {
            let key = unsafe { event.as_ref() };
            let swallow = PAN_KEY_HELD.load(std::sync::atomic::Ordering::Relaxed)
                && key.isARepeat()
                && key.keyCode() == SPACE_KEY_CODE;
            if swallow {
                std::ptr::null_mut()
            } else {
                event.as_ptr()
            }
        },
    );
    let monitor = unsafe {
        NSEvent::addLocalMonitorForEventsMatchingMask_handler(
            NSEventMask::KeyDown,
            &handler,
        )
    };
    // モニタとハンドラはアプリと同じ寿命なので、解放せずに保持し続ける
    std::mem::forget(monitor);
    std::mem::forget(handler);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|_app| {
            #[cfg(target_os = "macos")]
            install_space_repeat_filter();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            write_text_file_atomic,
            set_pan_key_held
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
