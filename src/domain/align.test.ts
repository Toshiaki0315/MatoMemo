import { describe, expect, it } from "vitest";
import { createBoard, createStickyNote } from "./board";
import { addItem } from "./boardOps";
import { alignItems, distributeItems, type Alignment } from "./align";

/**
 * 位置と大きさの異なる付箋 3 枚を持つボード。
 * a: (0, 0) 100x100 / b: (200, 50) 50x50 / c: (400, 120) 80x40
 */
function threeItems() {
  let board = createBoard({ id: "b" });
  board = addItem(
    board,
    createStickyNote({ id: "a", x: 0, y: 0, width: 100, height: 100 }),
  );
  board = addItem(
    board,
    createStickyNote({ id: "b", x: 200, y: 50, width: 50, height: 50 }),
  );
  return addItem(
    board,
    createStickyNote({ id: "c", x: 400, y: 120, width: 80, height: 40 }),
  );
}

const ALL = ["a", "b", "c"];

function positions(board: ReturnType<typeof threeItems>) {
  return board.items.map((item) => ({ x: item.x, y: item.y }));
}

describe("alignItems: 横位置", () => {
  it("左揃えで x が最も左の辺にそろう", () => {
    const board = alignItems(threeItems(), ALL, "left");
    expect(positions(board)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 0, y: 120 },
    ]);
  });

  it("右揃えで右辺がそろう", () => {
    // 右端は c の 400 + 80 = 480
    const board = alignItems(threeItems(), ALL, "right");
    expect(positions(board)).toEqual([
      { x: 380, y: 0 },
      { x: 430, y: 50 },
      { x: 400, y: 120 },
    ]);
  });

  it("左右中央揃えで中心の x がそろう", () => {
    // 全体は x: 0〜480 なので中心は 240
    const board = alignItems(threeItems(), ALL, "centerX");
    expect(positions(board)).toEqual([
      { x: 190, y: 0 },
      { x: 215, y: 50 },
      { x: 200, y: 120 },
    ]);
  });
});

describe("alignItems: 縦位置", () => {
  it("上揃えで y が最も上の辺にそろう", () => {
    const board = alignItems(threeItems(), ALL, "top");
    expect(positions(board)).toEqual([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 400, y: 0 },
    ]);
  });

  it("下揃えで下辺がそろう", () => {
    // 下端は c の 120 + 40 = 160
    const board = alignItems(threeItems(), ALL, "bottom");
    expect(positions(board)).toEqual([
      { x: 0, y: 60 },
      { x: 200, y: 110 },
      { x: 400, y: 120 },
    ]);
  });

  it("上下中央揃えで中心の y がそろう", () => {
    // 全体は y: 0〜160 なので中心は 80
    const board = alignItems(threeItems(), ALL, "middle");
    expect(positions(board)).toEqual([
      { x: 0, y: 30 },
      { x: 200, y: 55 },
      { x: 400, y: 60 },
    ]);
  });
});

describe("alignItems: 変化しない場合", () => {
  it("2 つ未満なら同じボードを返す", () => {
    const board = threeItems();
    expect(alignItems(board, ["a"], "left")).toBe(board);
    expect(alignItems(board, [], "left")).toBe(board);
  });

  it("既にそろっていれば同じボードを返す", () => {
    const aligned = alignItems(threeItems(), ALL, "left");
    expect(alignItems(aligned, ALL, "left")).toBe(aligned);
  });

  it("存在しない id は無視する", () => {
    const board = threeItems();
    expect(alignItems(board, ["a", "missing"], "left")).toBe(board);
  });

  it("選ばれていないアイテムは動かない", () => {
    const board = alignItems(threeItems(), ["a", "b"], "top");
    expect(board.items[2]).toMatchObject({ x: 400, y: 120 });
  });
});

describe("alignItems: すべての種類が有効", () => {
  const alignments: readonly Alignment[] = [
    "left",
    "centerX",
    "right",
    "top",
    "middle",
    "bottom",
  ];

  it.each(alignments)("%s で例外にならない", (alignment) => {
    expect(() => alignItems(threeItems(), ALL, alignment)).not.toThrow();
  });
});

describe("distributeItems: 横等間隔", () => {
  /**
   * すき間が 20 と 60 で不ぞろいな 3 枚。
   * a: x 0〜100 / b: x 120〜170 (すき間 20) / c: x 230〜310 (すき間 60)
   */
  function unevenRow() {
    let board = createBoard({ id: "b" });
    board = addItem(
      board,
      createStickyNote({ id: "a", x: 0, y: 0, width: 100, height: 100 }),
    );
    board = addItem(
      board,
      createStickyNote({ id: "b", x: 120, y: 10, width: 50, height: 50 }),
    );
    return addItem(
      board,
      createStickyNote({ id: "c", x: 230, y: 20, width: 80, height: 40 }),
    );
  }

  it("最も狭いすき間にそろえて並べ直す", () => {
    const board = distributeItems(unevenRow(), ALL, "horizontal");
    // すき間はすべて 20 になる。先頭は動かない。
    expect(board.items.map((item) => item.x)).toEqual([0, 120, 190]);
    // 縦位置は変わらない
    expect(board.items.map((item) => item.y)).toEqual([0, 10, 20]);
  });

  it("選択した順ではなく位置の順で並べる", () => {
    const board = distributeItems(unevenRow(), ["c", "a", "b"], "horizontal");
    expect(board.items.map((item) => item.x)).toEqual([0, 120, 190]);
  });

  it("既に等間隔なら同じボードを返す", () => {
    const board = distributeItems(unevenRow(), ALL, "horizontal");
    expect(distributeItems(board, ALL, "horizontal")).toBe(board);
  });

  it("3 つ未満なら同じボードを返す", () => {
    const board = unevenRow();
    expect(distributeItems(board, ["a", "b"], "horizontal")).toBe(board);
  });

  it("重なっている場合は重なりの深さをそろえる", () => {
    // a: 0〜100 と b: 60〜160 は 40 重なる (すき間 -40)。c は離れている。
    let board = createBoard({ id: "b" });
    board = addItem(
      board,
      createStickyNote({ id: "a", x: 0, y: 0, width: 100, height: 100 }),
    );
    board = addItem(
      board,
      createStickyNote({ id: "b", x: 60, y: 0, width: 100, height: 100 }),
    );
    board = addItem(
      board,
      createStickyNote({ id: "c", x: 300, y: 0, width: 100, height: 100 }),
    );
    const distributed = distributeItems(board, ALL, "horizontal");
    expect(distributed.items.map((item) => item.x)).toEqual([0, 60, 120]);
  });
});

describe("distributeItems: 縦等間隔", () => {
  it("最も狭いすき間にそろえて並べ直す", () => {
    // a: y 0〜100 / b: y 110〜160 (すき間 10) / c: y 200〜240 (すき間 40)
    let board = createBoard({ id: "b" });
    board = addItem(
      board,
      createStickyNote({ id: "a", x: 0, y: 0, width: 100, height: 100 }),
    );
    board = addItem(
      board,
      createStickyNote({ id: "b", x: 10, y: 110, width: 50, height: 50 }),
    );
    board = addItem(
      board,
      createStickyNote({ id: "c", x: 20, y: 200, width: 80, height: 40 }),
    );
    const distributed = distributeItems(board, ALL, "vertical");
    expect(distributed.items.map((item) => item.y)).toEqual([0, 110, 170]);
    expect(distributed.items.map((item) => item.x)).toEqual([0, 10, 20]);
  });
});
