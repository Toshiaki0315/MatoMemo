/**
 * 複数アイテムの整列。
 *
 * 選択したアイテム全体の外接矩形を基準に、それぞれの位置を揃える。
 * PowerPoint などと同じく「選ばれたものの端・中央」に寄せる方式で、
 * 基準を別途選ばせる手間を掛けない。
 */

import type { Board, Item, ItemId } from "./board";

/** 整列の種類。left/centerX/right は横位置、top/middle/bottom は縦位置。 */
export type Alignment =
  | "left"
  | "centerX"
  | "right"
  | "top"
  | "middle"
  | "bottom";

/** 整列後の座標を返す。 */
function alignedPosition(
  item: Item,
  alignment: Alignment,
  edges: { left: number; right: number; top: number; bottom: number },
): { x: number; y: number } {
  switch (alignment) {
    case "left":
      return { x: edges.left, y: item.y };
    case "centerX":
      return {
        x: (edges.left + edges.right) / 2 - item.width / 2,
        y: item.y,
      };
    case "right":
      return { x: edges.right - item.width, y: item.y };
    case "top":
      return { x: item.x, y: edges.top };
    case "middle":
      return {
        x: item.x,
        y: (edges.top + edges.bottom) / 2 - item.height / 2,
      };
    default:
      return { x: item.x, y: edges.bottom - item.height };
  }
}

/**
 * 指定したアイテムを整列した新しいボードを返す。
 *
 * 揃える基準は指定したアイテム全体の外接矩形。2 つ未満のときや
 * 位置が変わらないときは同じボードの参照を返す（未保存扱いにしない）。
 */
export function alignItems(
  board: Board,
  ids: readonly ItemId[],
  alignment: Alignment,
): Board {
  const targets = new Set(ids);
  const selected = board.items.filter((item) => targets.has(item.id));
  if (selected.length < 2) {
    return board;
  }

  const edges = {
    left: Math.min(...selected.map((item) => item.x)),
    right: Math.max(...selected.map((item) => item.x + item.width)),
    top: Math.min(...selected.map((item) => item.y)),
    bottom: Math.max(...selected.map((item) => item.y + item.height)),
  };

  let changed = false;
  const items = board.items.map((item) => {
    if (!targets.has(item.id)) {
      return item;
    }
    const { x, y } = alignedPosition(item, alignment, edges);
    if (x === item.x && y === item.y) {
      return item;
    }
    changed = true;
    return { ...item, x, y };
  });

  return changed ? { ...board, items } : board;
}

/** 等間隔に並べる方向。 */
export type DistributeAxis = "horizontal" | "vertical";

/**
 * 指定したアイテムを等間隔に並べた新しいボードを返す。
 *
 * 並び順（横なら x、縦なら y の昇順）は保ち、先頭のアイテムを動かさずに
 * 残りを詰め直す。間隔は「隣同士のすき間のうち最も狭いもの」に合わせる。
 * 全体の幅に均すのではなく狭い方に寄せることで、離れた 1 つに引きずられて
 * まとまりが崩れることがない。
 *
 * 3 つ未満のときや、既に等間隔のときは同じボードの参照を返す。
 */
export function distributeItems(
  board: Board,
  ids: readonly ItemId[],
  axis: DistributeAxis,
): Board {
  const targets = new Set(ids);
  const selected = board.items.filter((item) => targets.has(item.id));
  if (selected.length < 3) {
    return board;
  }

  const start = (item: Item) => (axis === "horizontal" ? item.x : item.y);
  const length = (item: Item) =>
    axis === "horizontal" ? item.width : item.height;

  const sorted = [...selected].sort((a, b) => start(a) - start(b));

  // 最も狭いすき間（重なっていれば負の値）を求める
  let gap = Number.POSITIVE_INFINITY;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1] as Item;
    const current = sorted[index] as Item;
    gap = Math.min(gap, start(current) - (start(previous) + length(previous)));
  }

  // 先頭は動かさず、以降を「前のアイテムの端 + すき間」に置き直す
  const moved = new Map<ItemId, number>();
  let position = start(sorted[0] as Item);
  for (const item of sorted) {
    moved.set(item.id, position);
    position += length(item) + gap;
  }

  let changed = false;
  const items = board.items.map((item) => {
    const value = moved.get(item.id);
    if (value === undefined || value === start(item)) {
      return item;
    }
    changed = true;
    return axis === "horizontal"
      ? { ...item, x: value }
      : { ...item, y: value };
  });

  return changed ? { ...board, items } : board;
}
