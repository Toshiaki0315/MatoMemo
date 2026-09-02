/**
 * キャンバス上の座標からアイテムを特定する当たり判定。
 *
 * 座標はすべてワールド座標。画面座標からの変換は呼び出し側で
 * `viewport.toWorld` を使って済ませておく。
 */

import { lineEndpoints, type Item } from "./board";
import {
  distanceToSegment,
  ellipseContainsPoint,
  rectContainsPoint,
  rectContainsRect,
  type Point,
  type Rect,
} from "./geometry";

/**
 * 直線図形を掴めるとみなす画面上の距離 (px)。
 * 線そのものは細いので、見た目より広めに取る。
 */
export const LINE_HIT_TOLERANCE = 8;

/** アイテムの外接矩形を返す。 */
export function itemBounds(item: Item): Rect {
  return { x: item.x, y: item.y, width: item.width, height: item.height };
}

/**
 * その 1 件のアイテムが点を含むかを判定する。
 * @param scale 表示倍率。直線の掴める距離を画面上で一定にするために使う
 */
function containsPoint(item: Item, point: Point, scale: number): boolean {
  const bounds = itemBounds(item);
  // 円だけは外接矩形ではなく楕円で判定する。矩形で判定すると
  // 見た目には何もない四隅をクリックしても選択されてしまう。
  if (item.type === "shape" && item.shape === "circle") {
    return ellipseContainsPoint(bounds, point);
  }
  // 直線は外接矩形ではなく線分との距離で判定する。矩形で判定すると
  // 斜めの線の何もない側をクリックしても選択されてしまう。
  if (item.type === "shape" && item.shape === "line") {
    const { from, to } = lineEndpoints(item);
    return distanceToSegment(point, from, to) <= LINE_HIT_TOLERANCE / scale;
  }
  return rectContainsPoint(bounds, point);
}

/**
 * 点に当たる最前面のアイテムを返す。
 *
 * `items` は背面から前面の順に並んでいる前提で、末尾から探索する。
 * @param scale 表示倍率。直線の掴める距離を画面上で一定にするために使う
 */
export function hitTest(
  items: readonly Item[],
  point: Point,
  scale = 1,
): Item | undefined {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item !== undefined && containsPoint(item, point, scale)) {
      return item;
    }
  }
  return undefined;
}

/**
 * 矩形に完全に含まれるアイテムを返す（ラバーバンド選択用）。
 * 一部だけが重なるアイテムは含めない。
 */
export function itemsWithinRect(
  items: readonly Item[],
  rect: Rect,
): readonly Item[] {
  return items.filter((item) => rectContainsRect(rect, itemBounds(item)));
}
