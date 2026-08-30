/**
 * アイテムの重なり順（Z-index）の操作。
 *
 * 重なり順は配列の並びそのもので表される。添字 0 が最背面、末尾が最前面。
 * どの操作も、順序が変わらない場合は元の配列と同じ参照を返す。
 * React に無駄な再レンダリングをさせないため。
 */

import type { Item, ItemId } from "./board";

/** 並びが変わっていなければ元の配列を返す。 */
function keepIfUnchanged(
  original: readonly Item[],
  next: readonly Item[],
): readonly Item[] {
  const unchanged = next.every((item, index) => item === original[index]);
  return unchanged ? original : next;
}

/** 選択されたアイテムと、それ以外に分ける。どちらも元の相対順を保つ。 */
function partition(
  items: readonly Item[],
  ids: ReadonlySet<ItemId>,
): { selected: Item[]; rest: Item[] } {
  const selected: Item[] = [];
  const rest: Item[] = [];
  for (const item of items) {
    if (ids.has(item.id)) {
      selected.push(item);
    } else {
      rest.push(item);
    }
  }
  return { selected, rest };
}

/** 指定したアイテムを最前面へ移す。 */
export function bringToFront(
  items: readonly Item[],
  ids: readonly ItemId[],
): readonly Item[] {
  const { selected, rest } = partition(items, new Set(ids));
  return keepIfUnchanged(items, [...rest, ...selected]);
}

/** 指定したアイテムを最背面へ移す。 */
export function sendToBack(
  items: readonly Item[],
  ids: readonly ItemId[],
): readonly Item[] {
  const { selected, rest } = partition(items, new Set(ids));
  return keepIfUnchanged(items, [...selected, ...rest]);
}

/**
 * 指定したアイテムを一つ手前へ移す。
 *
 * 前面側から順に処理する。そうしないと、直前に動かしたアイテムを
 * 追い越してしまい、複数選択時の相対順が崩れる。
 */
export function bringForward(
  items: readonly Item[],
  ids: readonly ItemId[],
): readonly Item[] {
  const selected = new Set(ids);
  const next = [...items];
  for (let index = next.length - 2; index >= 0; index -= 1) {
    const item = next[index];
    const ahead = next[index + 1];
    if (
      item === undefined ||
      ahead === undefined ||
      !selected.has(item.id) ||
      // 一つ前も選択されている場合は入れ替えても意味がない
      selected.has(ahead.id)
    ) {
      continue;
    }
    next[index] = ahead;
    next[index + 1] = item;
  }
  return keepIfUnchanged(items, next);
}

/** 指定したアイテムを一つ奥へ移す。 */
export function sendBackward(
  items: readonly Item[],
  ids: readonly ItemId[],
): readonly Item[] {
  const selected = new Set(ids);
  const next = [...items];
  for (let index = 1; index < next.length; index += 1) {
    const item = next[index];
    const behind = next[index - 1];
    if (
      item === undefined ||
      behind === undefined ||
      !selected.has(item.id) ||
      selected.has(behind.id)
    ) {
      continue;
    }
    next[index] = behind;
    next[index - 1] = item;
  }
  return keepIfUnchanged(items, next);
}
