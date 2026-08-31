/**
 * キャンバスのスクロールバーの計算。
 *
 * キャンバスは無限に広がるため固定のスクロール範囲が無い。そこで
 * 「アイテム全体の外接矩形」と「今見えている範囲」を合わせた矩形を
 * その時点のスクロール範囲とみなす。内容がすべて見えている軸は
 * スクロールの余地が無いので、その軸のバーは出さない。
 */

import type { Item } from "./board";
import type { Rect, Size } from "./geometry";
import { visibleWorldRect, type Viewport } from "./viewport";

/** スクロールバー 1 本分の状態。長さはトラック長に対する割合で表す。 */
export interface ScrollbarTrack {
  /** つまみの長さ。トラック長に対する割合 (0〜1)。 */
  readonly thumbSize: number;
  /** つまみの位置。動かせる余白に対する割合 (0〜1)。 */
  readonly thumbPosition: number;
  /** つまみを余白いっぱい動かしたときのワールド座標の移動量。 */
  readonly scrollableWorld: number;
}

export interface ScrollbarModel {
  /** 左右のスクロール。null なら横方向はすべて見えている。 */
  readonly horizontal: ScrollbarTrack | null;
  /** 上下のスクロール。null なら縦方向はすべて見えている。 */
  readonly vertical: ScrollbarTrack | null;
}

/** アイテム全体の外接矩形。アイテムが無ければ null。 */
export function contentBounds(items: readonly Item[]): Rect | null {
  const first = items[0];
  if (first === undefined) {
    return null;
  }
  let left = first.x;
  let top = first.y;
  let right = first.x + first.width;
  let bottom = first.y + first.height;
  for (const item of items.slice(1)) {
    left = Math.min(left, item.x);
    top = Math.min(top, item.y);
    right = Math.max(right, item.x + item.width);
    bottom = Math.max(bottom, item.y + item.height);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** 1 軸分のスクロールバーを計算する。スクロールの余地が無ければ null。 */
function trackFor(
  contentStart: number | undefined,
  contentEnd: number | undefined,
  visibleStart: number,
  visibleLength: number,
): ScrollbarTrack | null {
  const visibleEnd = visibleStart + visibleLength;
  const start =
    contentStart === undefined
      ? visibleStart
      : Math.min(contentStart, visibleStart);
  const end =
    contentEnd === undefined ? visibleEnd : Math.max(contentEnd, visibleEnd);
  const length = end - start;
  if (length <= visibleLength) {
    return null;
  }
  const scrollableWorld = length - visibleLength;
  return {
    thumbSize: visibleLength / length,
    thumbPosition: (visibleStart - start) / scrollableWorld,
    scrollableWorld,
  };
}

/** 今の表示に対するスクロールバーの状態を求める。 */
export function scrollbarModel(
  items: readonly Item[],
  viewport: Viewport,
  view: Size,
): ScrollbarModel {
  const visible = visibleWorldRect(viewport, view.width, view.height);
  const content = contentBounds(items);
  return {
    horizontal: trackFor(
      content?.x,
      content === null ? undefined : content.x + content.width,
      visible.x,
      visible.width,
    ),
    vertical: trackFor(
      content?.y,
      content === null ? undefined : content.y + content.height,
      visible.y,
      visible.height,
    ),
  };
}
