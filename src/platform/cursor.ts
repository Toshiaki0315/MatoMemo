/**
 * Space によるパン操作中、マウスカーソルの表示を保つためのプラットフォーム連携。
 *
 * macOS はキーが押されるたびにカーソルを「マウスが動くまで」隠す。
 * Space でのパンはキーを押しっぱなしにするため、そのままではカーソルが
 * 見えない状態が続いてしまう。Rust 側の `set_pan_key_held` コマンドが、
 * 押した瞬間の隠蔽を打ち消し、押している間のキーリピート（リピートの
 * たびに隠される）を握りつぶす。
 */

import { invoke } from "@tauri-apps/api/core";

/** Space によるパン操作の開始 (true)・終了 (false) を知らせる。 */
export function setPanKeyHeld(held: boolean): void {
  try {
    void invoke("set_pan_key_held", { held }).catch(() => {
      // 呼べなくてもカーソルが隠れるだけなので、操作は続けられる
    });
  } catch {
    // Tauri の外（ブラウザでの開発時など）では呼べない。
    // ブラウザにはこの問題自体が起きにくいため、何もしない。
  }
}
