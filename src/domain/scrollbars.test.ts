import { describe, expect, it } from "vitest";
import { createStickyNote } from "./board";
import { contentBounds, scrollbarModel } from "./scrollbars";

/** 指定した位置・大きさの付箋。 */
function sticky(id: string, x: number, y: number, width = 100, height = 100) {
  return createStickyNote({ id, x, y, width, height });
}

const VIEW = { width: 800, height: 600 };

describe("contentBounds", () => {
  it("アイテムが無ければ null", () => {
    expect(contentBounds([])).toBeNull();
  });

  it("1 つならその外接矩形", () => {
    expect(contentBounds([sticky("a", 10, 20)])).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 100,
    });
  });

  it("複数をすべて含む矩形になる", () => {
    expect(
      contentBounds([sticky("a", -50, 0), sticky("b", 300, 500)]),
    ).toEqual({ x: -50, y: 0, width: 450, height: 600 });
  });
});

describe("scrollbarModel", () => {
  it("内容がすべて見えていればどちらのバーも出さない", () => {
    const model = scrollbarModel(
      [sticky("a", 100, 100)],
      { x: 0, y: 0, scale: 1 },
      VIEW,
    );
    expect(model.horizontal).toBeNull();
    expect(model.vertical).toBeNull();
  });

  it("アイテムが無ければどちらのバーも出さない", () => {
    const model = scrollbarModel([], { x: 0, y: 0, scale: 1 }, VIEW);
    expect(model.horizontal).toBeNull();
    expect(model.vertical).toBeNull();
  });

  it("右にはみ出した内容があれば横のバーを出す", () => {
    // 内容は x: 0〜1600。見えているのは x: 0〜800 なので前半分。
    const model = scrollbarModel(
      [sticky("a", 0, 0), sticky("b", 1500, 0)],
      { x: 0, y: 0, scale: 1 },
      VIEW,
    );
    expect(model.horizontal).not.toBeNull();
    expect(model.horizontal?.thumbSize).toBeCloseTo(0.5);
    expect(model.horizontal?.thumbPosition).toBe(0);
    expect(model.horizontal?.scrollableWorld).toBeCloseTo(800);
    // 縦はすべて見えている
    expect(model.vertical).toBeNull();
  });

  it("末尾までスクロールするとつまみの位置は 1 になる", () => {
    // 見えている範囲は x: 800〜1600。内容の右端と一致する。
    const model = scrollbarModel(
      [sticky("a", 0, 0), sticky("b", 1500, 0)],
      { x: -800, y: 0, scale: 1 },
      VIEW,
    );
    expect(model.horizontal?.thumbPosition).toBeCloseTo(1);
  });

  it("内容より外を見ているときは見えている範囲まで含める", () => {
    // 内容は x: 0〜100 だが、視界は x: 1000〜1800 まで離れている。
    // 範囲は 0〜1800 になり、つまみは右端に付く。
    const model = scrollbarModel(
      [sticky("a", 0, 0)],
      { x: -1000, y: 0, scale: 1 },
      VIEW,
    );
    expect(model.horizontal?.thumbSize).toBeCloseTo(800 / 1800);
    expect(model.horizontal?.thumbPosition).toBeCloseTo(1);
    expect(model.horizontal?.scrollableWorld).toBeCloseTo(1000);
  });

  it("縮小して全体が見えればバーは消える", () => {
    const items = [sticky("a", 0, 0), sticky("b", 1500, 0)];
    const model = scrollbarModel(items, { x: 0, y: 0, scale: 0.5 }, VIEW);
    // 0.5 倍なら見えるワールド幅は 1600 で、内容の幅と一致する
    expect(model.horizontal).toBeNull();
  });

  it("拡大すると縦横ともバーが出る", () => {
    const model = scrollbarModel(
      [sticky("a", 0, 0, 800, 600)],
      { x: 0, y: 0, scale: 2 },
      VIEW,
    );
    expect(model.horizontal?.thumbSize).toBeCloseTo(0.5);
    expect(model.vertical?.thumbSize).toBeCloseTo(0.5);
  });
});
