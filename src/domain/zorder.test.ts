import { describe, expect, it } from "vitest";
import { createStickyNote, type Item } from "./board";
import {
  bringForward,
  bringToFront,
  sendBackward,
  sendToBack,
} from "./zorder";

/** id だけが異なる付箋を並べたアイテム列。背面 → 前面の順。 */
function items(...ids: string[]): Item[] {
  return ids.map((id) => createStickyNote({ id, x: 0, y: 0 }));
}

/** 並び順を id の配列で取り出す。 */
function order(list: readonly Item[]): string[] {
  return list.map((item) => item.id);
}

describe("bringToFront", () => {
  it("指定したアイテムを最前面に移す", () => {
    expect(order(bringToFront(items("a", "b", "c"), ["a"]))).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("複数選択では相対順を保ったまま最前面に移す", () => {
    expect(order(bringToFront(items("a", "b", "c", "d"), ["a", "c"]))).toEqual([
      "b",
      "d",
      "a",
      "c",
    ]);
  });

  it("既に最前面なら元の配列をそのまま返す", () => {
    const list = items("a", "b", "c");
    expect(bringToFront(list, ["c"])).toBe(list);
  });

  it("すべて選択しても元の配列をそのまま返す", () => {
    const list = items("a", "b");
    expect(bringToFront(list, ["a", "b"])).toBe(list);
  });

  it("対象が空なら元の配列をそのまま返す", () => {
    const list = items("a", "b");
    expect(bringToFront(list, [])).toBe(list);
  });
});

describe("sendToBack", () => {
  it("指定したアイテムを最背面に移す", () => {
    expect(order(sendToBack(items("a", "b", "c"), ["c"]))).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("複数選択では相対順を保ったまま最背面に移す", () => {
    expect(order(sendToBack(items("a", "b", "c", "d"), ["b", "d"]))).toEqual([
      "b",
      "d",
      "a",
      "c",
    ]);
  });

  it("既に最背面なら元の配列をそのまま返す", () => {
    const list = items("a", "b", "c");
    expect(sendToBack(list, ["a"])).toBe(list);
  });
});

describe("bringForward", () => {
  it("一つ手前に移す", () => {
    expect(order(bringForward(items("a", "b", "c"), ["a"]))).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("最前面のアイテムは動かさない", () => {
    const list = items("a", "b", "c");
    expect(bringForward(list, ["c"])).toBe(list);
  });

  it("複数選択でも一つずつ手前に移す", () => {
    expect(order(bringForward(items("a", "b", "c", "d"), ["a", "b"]))).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
  });

  it("前が選択済みなら詰まって動かない", () => {
    // c は最前面、b はその手前に行けないので順序は変わらない
    const list = items("a", "b", "c");
    expect(bringForward(list, ["b", "c"])).toBe(list);
  });

  it("対象が空なら元の配列をそのまま返す", () => {
    const list = items("a", "b");
    expect(bringForward(list, [])).toBe(list);
  });
});

describe("sendBackward", () => {
  it("一つ奥に移す", () => {
    expect(order(sendBackward(items("a", "b", "c"), ["c"]))).toEqual([
      "a",
      "c",
      "b",
    ]);
  });

  it("最背面のアイテムは動かさない", () => {
    const list = items("a", "b", "c");
    expect(sendBackward(list, ["a"])).toBe(list);
  });

  it("複数選択でも一つずつ奥に移す", () => {
    expect(order(sendBackward(items("a", "b", "c", "d"), ["c", "d"]))).toEqual([
      "a",
      "c",
      "d",
      "b",
    ]);
  });

  it("奥が選択済みなら詰まって動かない", () => {
    const list = items("a", "b", "c");
    expect(sendBackward(list, ["a", "b"])).toBe(list);
  });
});

describe("存在しない id", () => {
  it("無視して元の配列をそのまま返す", () => {
    const list = items("a", "b");
    expect(bringToFront(list, ["zzz"])).toBe(list);
    expect(sendToBack(list, ["zzz"])).toBe(list);
    expect(bringForward(list, ["zzz"])).toBe(list);
    expect(sendBackward(list, ["zzz"])).toBe(list);
  });
});
