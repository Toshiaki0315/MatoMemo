//! メニューバー。
//!
//! Tauri の既定のメニューは英語で、ボードの操作も入っていない。macOS の
//! 慣習に沿った日本語のメニューを組み、ボードの操作を選んだら
//! フロントエンドへ `menu-action` イベントで知らせる。
//!
//! 編集の項目（取り消す・コピーなど）もフロントエンドに任せる。文字の入力中は
//! フロントエンドが [`perform_native_edit`] を呼び返し、入力欄の標準の操作を行う。
//! 標準の項目をそのまま使うと、文字の入力中にしか働かない（付箋のコピーに使えない）ため。

use tauri::menu::{
    AboutMetadataBuilder, Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder,
};
use tauri::{AppHandle, Emitter, Runtime};

/// メニューの項目を選んだときにフロントエンドへ送るイベントの名前。
pub const MENU_EVENT: &str = "menu-action";

/// フロントエンドに任せる項目（id、表示名、ショートカット）。
/// id はフロントエンドの `MenuAction` と一致させる。
type ItemSpec = (&'static str, &'static str, Option<&'static str>);

const FILE_ITEMS: &[ItemSpec] = &[
    ("new", "新規ボード", Some("CmdOrCtrl+N")),
    ("open", "開く…", Some("CmdOrCtrl+O")),
];

const SAVE_ITEMS: &[ItemSpec] = &[
    ("save", "保存", Some("CmdOrCtrl+S")),
    ("saveAs", "別名で保存…", Some("CmdOrCtrl+Shift+S")),
];

const EXPORT_ITEMS: &[ItemSpec] = &[
    ("exportSvg", "SVG…", None),
    ("exportPng", "PNG…", None),
    ("exportMarkdown", "Markdown…", None),
];

const HISTORY_ITEMS: &[ItemSpec] = &[
    ("undo", "取り消す", Some("CmdOrCtrl+Z")),
    ("redo", "やり直す", Some("CmdOrCtrl+Shift+Z")),
];

const CLIPBOARD_ITEMS: &[ItemSpec] = &[
    ("cut", "カット", Some("CmdOrCtrl+X")),
    ("copy", "コピー", Some("CmdOrCtrl+C")),
    ("paste", "ペースト", Some("CmdOrCtrl+V")),
    ("duplicate", "複製", Some("CmdOrCtrl+D")),
    // Delete キーは文字の削除と同じキーなので、ショートカットは付けない
    // （キャンバス上の Delete はフロントエンドが直接受け取る）
    ("delete", "削除", None),
    ("selectAll", "すべてを選択", Some("CmdOrCtrl+A")),
];

const ZOOM_ITEMS: &[ItemSpec] = &[
    ("zoomIn", "拡大", Some("CmdOrCtrl+=")),
    ("zoomOut", "縮小", Some("CmdOrCtrl+-")),
    ("zoomReset", "実際のサイズ", Some("CmdOrCtrl+0")),
];

/// 項目の一覧から、フロントエンドに任せる項目を作る。
fn items<R: Runtime>(
    app: &AppHandle<R>,
    specs: &[ItemSpec],
) -> tauri::Result<Vec<tauri::menu::MenuItem<R>>> {
    specs
        .iter()
        .map(|(id, text, accelerator)| {
            let builder = MenuItemBuilder::with_id(*id, *text);
            match accelerator {
                Some(accelerator) => builder.accelerator(*accelerator),
                None => builder,
            }
            .build(app)
        })
        .collect()
}

/// 作った項目を `&dyn IsMenuItem` の並びにする（SubmenuBuilder::items に渡すため）。
fn refs<R: Runtime>(items: &[tauri::menu::MenuItem<R>]) -> Vec<&dyn tauri::menu::IsMenuItem<R>> {
    items
        .iter()
        .map(|item| item as &dyn tauri::menu::IsMenuItem<R>)
        .collect()
}

/// メニューバー全体を組む。
pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let package = app.package_info();
    let name = package.name.clone();

    let about = PredefinedMenuItem::about(
        app,
        Some(&format!("{name} について")),
        Some(
            AboutMetadataBuilder::new()
                .name(Some(name.clone()))
                .version(Some(package.version.to_string()))
                .build(),
        ),
    )?;
    // 終了は未保存の確認を挟むため、フロントエンドに任せる。
    // 標準の項目だとウインドウを閉じる確認を通らず、そのまま終わってしまう
    let quit = MenuItemBuilder::with_id("quit", format!("{name} を終了"))
        .accelerator("CmdOrCtrl+Q")
        .build(app)?;
    let app_menu = SubmenuBuilder::new(app, &name)
        .item(&about)
        .separator()
        .services_with_text("サービス")
        .separator()
        .hide_with_text(format!("{name} を隠す"))
        .hide_others_with_text("ほかを隠す")
        .show_all_with_text("すべてを表示")
        .separator()
        .item(&quit)
        .build()?;

    let file_items = items(app, FILE_ITEMS)?;
    let save_items = items(app, SAVE_ITEMS)?;
    let export_items = items(app, EXPORT_ITEMS)?;
    let export_menu = SubmenuBuilder::new(app, "書き出す")
        .items(&refs(&export_items))
        .build()?;
    let file_menu = SubmenuBuilder::new(app, "ファイル")
        .items(&refs(&file_items))
        .separator()
        .items(&refs(&save_items))
        .separator()
        .item(&export_menu)
        .separator()
        // ウインドウを閉じる要求は、フロントエンドの未保存の確認を通る
        .close_window_with_text("ウインドウを閉じる")
        .build()?;

    let history_items = items(app, HISTORY_ITEMS)?;
    let clipboard_items = items(app, CLIPBOARD_ITEMS)?;
    let edit_menu = SubmenuBuilder::new(app, "編集")
        .items(&refs(&history_items))
        .separator()
        .items(&refs(&clipboard_items))
        .build()?;

    let zoom_items = items(app, ZOOM_ITEMS)?;
    let view_menu = SubmenuBuilder::new(app, "表示")
        .items(&refs(&zoom_items))
        .separator()
        .fullscreen_with_text("フルスクリーンにする")
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "ウインドウ")
        .minimize_with_text("しまう")
        .maximize_with_text("拡大／縮小")
        .separator()
        .bring_all_to_front_with_text("すべてを手前に移動")
        .build()?;
    // ウインドウの一覧を macOS に付け足してもらう
    #[cfg(target_os = "macos")]
    window_menu.set_as_windows_menu_for_nsapp()?;

    MenuBuilder::new(app)
        .items(&[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu])
        .build()
}

/// フロントエンドに任せる項目が選ばれたら、その id を知らせる。
/// 標準の項目（隠す・しまうなど）は macOS が処理するので、ここには来ない。
pub fn forward<R: Runtime>(app: &AppHandle<R>, id: &str) {
    let _ = app.emit(MENU_EVENT, id);
}

/// 文字の入力中に選ばれた編集の項目を、入力欄の標準の操作として行う。
///
/// 標準の項目と同じく、操作を表すセレクタを最前面のレスポンダへ送る。
#[tauri::command]
pub fn perform_native_edit(app: AppHandle, action: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use objc2::sel;
        let selector = match action.as_str() {
            "undo" => sel!(undo:),
            "redo" => sel!(redo:),
            "cut" => sel!(cut:),
            "copy" => sel!(copy:),
            "paste" => sel!(paste:),
            "delete" => sel!(delete:),
            "selectAll" => sel!(selectAll:),
            other => return Err(format!("入力欄では行えない操作です: {other}")),
        };
        app.run_on_main_thread(move || {
            if let Some(mtm) = objc2::MainThreadMarker::new() {
                let ns_app = objc2_app_kit::NSApplication::sharedApplication(mtm);
                // SAFETY: 標準の編集のセレクタで、送り先は最前面のレスポンダ (None)
                unsafe { ns_app.sendAction_to_from(selector, None, None) };
            }
        })
        .map_err(|error| error.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, action);
        Ok(())
    }
}
