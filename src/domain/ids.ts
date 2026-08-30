/** 一意な識別子の生成。 */

/**
 * アイテムやコネクタの id を採番する。
 *
 * WebView / Node のどちらにも標準で存在する `crypto.randomUUID` を使う。
 * テストでは決定的な id が欲しいため、ストアの生成時に差し替えられるよう
 * この関数への依存は注入で受け取る形にしている。
 */
export function createId(): string {
  return crypto.randomUUID();
}
