/**
 * アイテムのコピー・貼り付け。
 *
 * コピーしたものはボードとは別に保持し、貼り付けのたびに新しい id を
 * 振り直して複製する。選んだアイテム同士を結ぶコネクタも一緒に写す。
 * 片方の端だけが選ばれたコネクタは、貼り付け先で繋ぐ相手がいないので含めない。
 */

import type { Board, Connector, Item, ItemId } from "./board";

/** 貼り付けのたびに、前回からずらす量（ワールド px）。 */
export const PASTE_OFFSET = 24;

/** コピーした内容。 */
export interface ClipboardContent {
  /** 重なり順（背面→前面）を保ったアイテム。 */
  readonly items: readonly Item[];
  /** `items` 同士を結ぶコネクタ。 */
  readonly connectors: readonly Connector[];
}

/**
 * 指定したアイテムをコピーする。
 * 対象が 1 つも無ければ null（クリップボードを空にしないため）。
 */
export function copyItems(
  board: Board,
  ids: readonly ItemId[],
): ClipboardContent | null {
  const selected = new Set(ids);
  const items = board.items.filter((item) => selected.has(item.id));
  if (items.length === 0) {
    return null;
  }
  const connectors = board.connectors.filter(
    (connector) =>
      selected.has(connector.fromItemId) && selected.has(connector.toItemId),
  );
  return { items, connectors };
}

/** 貼り付けの結果。 */
export interface PasteResult {
  readonly board: Board;
  /** 新しく置いたアイテムの id（重なり順）。 */
  readonly ids: readonly ItemId[];
}

/**
 * コピーした内容を新しい id で複製して貼り付ける。
 *
 * 貼り付けたものは最前面に置く。元の重なり順と相対的な位置関係は保つ。
 * @param offset 元の位置からずらす量（ワールド px、右下方向）
 */
export function pasteItems(
  board: Board,
  content: ClipboardContent,
  offset: number,
  createId: () => string,
): PasteResult {
  const idMap = new Map<ItemId, ItemId>();
  const items = content.items.map((item) => {
    const id = createId();
    idMap.set(item.id, id);
    return { ...item, id, x: item.x + offset, y: item.y + offset };
  });
  const connectors = content.connectors.flatMap((connector) => {
    const fromItemId = idMap.get(connector.fromItemId);
    const toItemId = idMap.get(connector.toItemId);
    // copyItems が両端のそろったものだけを入れるので、ここで欠けることはない
    if (fromItemId === undefined || toItemId === undefined) {
      return [];
    }
    return [{ ...connector, id: createId(), fromItemId, toItemId }];
  });
  return {
    board: {
      ...board,
      items: [...board.items, ...items],
      connectors: [...board.connectors, ...connectors],
    },
    ids: items.map((item) => item.id),
  };
}
