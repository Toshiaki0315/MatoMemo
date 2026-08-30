/**
 * ウィンドウを閉じる要求を横取りするための抽象。
 *
 * Tauri への依存をこのファイルに閉じ込め、アプリ本体はインタフェースにだけ
 * 依存させる。テストでは手動で要求を発火できる実装に差し替える。
 */

import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * ウィンドウを閉じる要求を購読する。
 *
 * @param onRequest 閉じる要求が来たときに呼ばれる。閉じてよければ true を
 *   返す。false を返すと閉じる操作を取り消す（確認を出すなど）。
 * @returns 購読を解除する関数
 */
export type CloseRequestGuard = (
  onRequest: () => boolean | Promise<boolean>,
) => Promise<() => void>;

/** Tauri のウィンドウに対して閉じる要求を横取りする。 */
export const guardWindowClose: CloseRequestGuard = async (onRequest) => {
  const unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
    const mayClose = await onRequest();
    if (!mayClose) {
      // 既定の「閉じる」動作を止める。閉じてよくなったら
      // アプリ側から改めて destroy を呼ぶ。
      event.preventDefault();
    }
  });
  return unlisten;
};

/** ウィンドウを実際に閉じる。 */
export async function closeWindow(): Promise<void> {
  await getCurrentWindow().destroy();
}
