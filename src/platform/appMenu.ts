/**
 * メニューバーとの連携。
 *
 * メニューは Rust 側で組み、項目が選ばれると `menu-action` イベントで
 * 項目の id が届く。何をするかはここ（フロントエンド）で決める。
 * 文字の入力中に編集の項目が選ばれたときは、Rust 側に頼んで入力欄の
 * 標準の操作（文字のコピーなど）を行う。
 */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** メニューの項目の id。Rust 側（src-tauri/src/menu.rs）と一致させる。 */
export const MENU_ACTIONS = [
  "new",
  "open",
  "save",
  "saveAs",
  "exportSvg",
  "exportPng",
  "exportMarkdown",
  "undo",
  "redo",
  "cut",
  "copy",
  "paste",
  "duplicate",
  "delete",
  "selectAll",
  "zoomIn",
  "zoomOut",
  "zoomReset",
  "quit",
] as const;
export type MenuAction = (typeof MENU_ACTIONS)[number];

/** 入力欄の標準の操作として行える編集の項目。 */
export const NATIVE_EDIT_ACTIONS = [
  "undo",
  "redo",
  "cut",
  "copy",
  "paste",
  "delete",
  "selectAll",
] as const;
export type NativeEditAction = (typeof NATIVE_EDIT_ACTIONS)[number];

/** 入力欄の標準の操作として行える項目か。 */
export function isNativeEditAction(action: MenuAction): action is NativeEditAction {
  return (NATIVE_EDIT_ACTIONS as readonly string[]).includes(action);
}

/**
 * メニューの項目が選ばれたときの通知を受け取る。
 * @returns 購読を止める関数
 */
export type MenuActionSubscription = (
  onAction: (action: MenuAction) => void,
) => Promise<() => void>;

/** Tauri のイベントでメニューの項目を受け取る。 */
export const listenMenuActions: MenuActionSubscription = (onAction) =>
  listen<string>("menu-action", (event) => {
    // 知らない id は無視する（Rust 側だけ項目を増やした場合など）
    if ((MENU_ACTIONS as readonly string[]).includes(event.payload)) {
      onAction(event.payload as MenuAction);
    }
  });

/** 入力欄の標準の編集操作を行う（文字の入力中にメニューから選ばれたとき）。 */
export function performNativeEdit(action: NativeEditAction): void {
  try {
    void invoke("perform_native_edit", { action }).catch(() => {
      // 行えなくても文字の操作が効かないだけなので、編集は続けられる
    });
  } catch {
    // Tauri の外（ブラウザでの開発時など）にはメニューバーが無い
  }
}
