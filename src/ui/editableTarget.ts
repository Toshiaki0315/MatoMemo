/**
 * キーボードイベントの発生元がテキスト入力欄かを判定する。
 *
 * ボード全体へのショートカット（削除・取り消しなど）が、文字入力中の
 * 操作を横取りしないようにするために使う。
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}
