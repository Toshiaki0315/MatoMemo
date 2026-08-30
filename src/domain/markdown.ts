/**
 * ボードを Markdown の箇条書きに変換する。
 *
 * コネクタの向き（from → to）を親子関係とみなし、入れ子の箇条書きにする。
 * ホワイトボードは木とは限らない（循環したり、複数の親を持ったりする）ので、
 * そのままでは箇条書きにできない。ここでは次の規則で木に均す。
 *
 *   - 親を持たないアイテムを見出しの起点にする
 *   - 起点が一つも無い（全体が循環している）場合は、最初のアイテムを起点にする
 *   - 一度書き出したアイテムは二度目以降は参照として一行だけ書く
 *
 * こうすることで、どんな繋がり方でも必ず有限の出力になり、内容も失われない。
 */

import type { Board, Item, ItemId } from "./board";

/** 箇条書きの 1 段あたりの字下げ。 */
const INDENT = "  ";

/** アイテムから箇条書きに書く文字列を作る。 */
export function itemLabel(item: Item): string {
  if (item.type === "image") {
    return "（画像）";
  }
  const text = item.text.trim();
  if (text === "") {
    return item.type === "shape" && item.shape === "circle"
      ? "（円）"
      : item.type === "shape"
        ? "（矩形）"
        : "（空）";
  }
  // 改行は箇条書きを壊すので 1 行に均す
  return text.replace(/\s*\n\s*/g, " ");
}

/** id から子アイテムの id を引ける表を作る。 */
function buildChildren(board: Board): Map<ItemId, ItemId[]> {
  const children = new Map<ItemId, ItemId[]>();
  for (const connector of board.connectors) {
    const list = children.get(connector.fromItemId) ?? [];
    list.push(connector.toItemId);
    children.set(connector.fromItemId, list);
  }
  return children;
}

/** 親を持たないアイテム。無ければ全体が循環しているので先頭を起点にする。 */
function findRoots(board: Board): readonly Item[] {
  const hasParent = new Set(
    board.connectors.map((connector) => connector.toItemId),
  );
  const roots = board.items.filter((item) => !hasParent.has(item.id));
  if (roots.length > 0) {
    return roots;
  }
  const first = board.items[0];
  return first === undefined ? [] : [first];
}

/** ボードを Markdown の箇条書きに変換する。 */
export function boardToMarkdown(board: Board): string {
  const byId = new Map(board.items.map((item) => [item.id, item]));
  const children = buildChildren(board);
  const written = new Set<ItemId>();
  const lines: string[] = [`# ${board.name}`, ""];

  /** 1 件を書き出し、その子を再帰的に辿る。 */
  function write(item: Item, depth: number): void {
    const indent = INDENT.repeat(depth);
    if (written.has(item.id)) {
      // 既に書いたものは参照として 1 行だけ残す。
      // 同じ内容を繰り返さず、繋がりだけを伝える。
      lines.push(`${indent}- ${itemLabel(item)}（再掲）`);
      return;
    }
    written.add(item.id);
    lines.push(`${indent}- ${itemLabel(item)}`);

    for (const childId of children.get(item.id) ?? []) {
      const child = byId.get(childId);
      if (child !== undefined) {
        write(child, depth + 1);
      }
    }
  }

  for (const root of findRoots(board)) {
    write(root, 0);
  }

  // 循環の内側にいて、どの起点からも辿り着けなかったアイテムを拾う
  for (const item of board.items) {
    if (!written.has(item.id)) {
      write(item, 0);
    }
  }

  return `${lines.join("\n")}\n`;
}
