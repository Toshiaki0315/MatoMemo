/**
 * ボードに対する不変更新の操作。
 *
 * すべて「元のボードを変更せず新しいボードを返す」純関数として実装する。
 * 変化がない操作は同じ参照を返し、React の再レンダリングを無駄に起こさない。
 */

import type { Board, Connector, ConnectorId, Item, ItemId } from "./board";

/** アイテムを最前面（配列末尾）に追加する。 */
export function addItem(board: Board, item: Item): Board {
  return { ...board, items: [...board.items, item] };
}

/** コネクタを追加する。 */
export function addConnector(board: Board, connector: Connector): Board {
  return { ...board, connectors: [...board.connectors, connector] };
}

/** id からアイテムを引く。 */
export function findItem(board: Board, id: ItemId): Item | undefined {
  return board.items.find((item) => item.id === id);
}

/** そのアイテムに繋がっているコネクタを返す。 */
export function connectorsOf(
  board: Board,
  itemId: ItemId,
): readonly Connector[] {
  return board.connectors.filter(
    (connector) =>
      connector.fromItemId === itemId || connector.toItemId === itemId,
  );
}

/**
 * アイテムを取り除く。
 *
 * 繋がり先を失ったコネクタも同時に取り除く。片方だけが残ると
 * 描画も保存もできない不整合な状態になるため。
 */
export function removeItems(board: Board, ids: readonly ItemId[]): Board {
  const removing = new Set(ids);
  const items = board.items.filter((item) => !removing.has(item.id));
  const connectors = board.connectors.filter(
    (connector) =>
      !removing.has(connector.fromItemId) && !removing.has(connector.toItemId),
  );
  if (
    items.length === board.items.length &&
    connectors.length === board.connectors.length
  ) {
    return board;
  }
  return { ...board, items, connectors };
}

/** コネクタを取り除く。 */
export function removeConnectors(
  board: Board,
  ids: readonly ConnectorId[],
): Board {
  const removing = new Set(ids);
  const connectors = board.connectors.filter(
    (connector) => !removing.has(connector.id),
  );
  if (connectors.length === board.connectors.length) {
    return board;
  }
  return { ...board, connectors };
}

/** 同じ id のアイテムを差し替える。重なり順は変わらない。 */
export function replaceItem(board: Board, item: Item): Board {
  const index = board.items.findIndex((existing) => existing.id === item.id);
  if (index === -1 || board.items[index] === item) {
    return board;
  }
  const items = [...board.items];
  items[index] = item;
  return { ...board, items };
}

/** 指定したアイテムをワールド座標で平行移動する。 */
export function moveItems(
  board: Board,
  ids: readonly ItemId[],
  dx: number,
  dy: number,
): Board {
  if (ids.length === 0 || (dx === 0 && dy === 0)) {
    return board;
  }
  const moving = new Set(ids);
  return {
    ...board,
    items: board.items.map((item) =>
      moving.has(item.id) ? { ...item, x: item.x + dx, y: item.y + dy } : item,
    ),
  };
}
