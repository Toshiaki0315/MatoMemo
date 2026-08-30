import { describe, expect, it } from "vitest";
import {
  createBoard,
  createConnector,
  createShape,
  createStickyNote,
  type Board,
} from "./board";
import {
  addConnector,
  addItem,
  connectorsOf,
  findItem,
  moveItems,
  removeConnectors,
  removeItems,
  replaceItem,
} from "./boardOps";

/** 付箋 3 枚とコネクタ 2 本を持つボード。 */
function sampleBoard(): Board {
  let board = createBoard({ id: "b1" });
  board = addItem(board, createStickyNote({ id: "a", x: 0, y: 0 }));
  board = addItem(board, createStickyNote({ id: "b", x: 100, y: 0 }));
  board = addItem(board, createStickyNote({ id: "c", x: 200, y: 0 }));
  board = addConnector(
    board,
    createConnector({ id: "ab", fromItemId: "a", toItemId: "b" }),
  );
  board = addConnector(
    board,
    createConnector({ id: "bc", fromItemId: "b", toItemId: "c" }),
  );
  return board;
}

describe("addItem", () => {
  it("アイテムを最前面（配列末尾）に追加する", () => {
    const board = addItem(
      createBoard({ id: "b1" }),
      createStickyNote({ id: "a", x: 0, y: 0 }),
    );
    expect(board.items.map((item) => item.id)).toEqual(["a"]);
  });

  it("既存のアイテムより後ろに積む", () => {
    let board = addItem(
      createBoard({ id: "b1" }),
      createStickyNote({ id: "a", x: 0, y: 0 }),
    );
    board = addItem(board, createShape({ id: "b", shape: "circle", x: 0, y: 0 }));
    expect(board.items.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("元のボードを変更しない", () => {
    const board = createBoard({ id: "b1" });
    addItem(board, createStickyNote({ id: "a", x: 0, y: 0 }));
    expect(board.items).toEqual([]);
  });
});

describe("addConnector", () => {
  it("コネクタを追加する", () => {
    const board = addConnector(
      createBoard({ id: "b1" }),
      createConnector({ id: "c1", fromItemId: "a", toItemId: "b" }),
    );
    expect(board.connectors.map((c) => c.id)).toEqual(["c1"]);
  });
});

describe("findItem", () => {
  it("id からアイテムを引く", () => {
    expect(findItem(sampleBoard(), "b")?.x).toBe(100);
  });

  it("存在しない id には undefined を返す", () => {
    expect(findItem(sampleBoard(), "zzz")).toBeUndefined();
  });
});

describe("removeItems", () => {
  it("指定したアイテムを取り除く", () => {
    const board = removeItems(sampleBoard(), ["b"]);
    expect(board.items.map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("複数まとめて取り除ける", () => {
    const board = removeItems(sampleBoard(), ["a", "c"]);
    expect(board.items.map((item) => item.id)).toEqual(["b"]);
  });

  it("消したアイテムに繋がるコネクタも取り除く", () => {
    // b を消すと ab と bc の両方が繋がり先を失う
    expect(removeItems(sampleBoard(), ["b"]).connectors).toEqual([]);
  });

  it("関係のないコネクタは残す", () => {
    expect(removeItems(sampleBoard(), ["a"]).connectors.map((c) => c.id)).toEqual(
      ["bc"],
    );
  });

  it("存在しない id を渡しても何も起きない", () => {
    const board = sampleBoard();
    expect(removeItems(board, ["zzz"])).toEqual(board);
  });

  it("空の指定では元のボードをそのまま返す", () => {
    const board = sampleBoard();
    expect(removeItems(board, [])).toEqual(board);
  });
});

describe("removeConnectors", () => {
  it("指定したコネクタだけを取り除く", () => {
    const board = removeConnectors(sampleBoard(), ["ab"]);
    expect(board.connectors.map((c) => c.id)).toEqual(["bc"]);
    expect(board.items).toHaveLength(3);
  });
});

describe("connectorsOf", () => {
  it("そのアイテムに繋がるコネクタを返す", () => {
    expect(connectorsOf(sampleBoard(), "b").map((c) => c.id)).toEqual([
      "ab",
      "bc",
    ]);
  });

  it("繋がりがなければ空を返す", () => {
    expect(connectorsOf(sampleBoard(), "zzz")).toEqual([]);
  });
});

describe("replaceItem", () => {
  it("同じ id のアイテムを差し替える", () => {
    const board = replaceItem(
      sampleBoard(),
      createStickyNote({ id: "b", x: 999, y: 999, text: "更新" }),
    );
    expect(findItem(board, "b")).toMatchObject({ x: 999, text: "更新" });
  });

  it("重なり順を保つ", () => {
    const board = replaceItem(
      sampleBoard(),
      createStickyNote({ id: "b", x: 999, y: 999 }),
    );
    expect(board.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("存在しない id なら何も変えない", () => {
    const board = sampleBoard();
    expect(
      replaceItem(board, createStickyNote({ id: "zzz", x: 0, y: 0 })),
    ).toEqual(board);
  });
});

describe("moveItems", () => {
  it("指定したアイテムを差分だけ動かす", () => {
    const board = moveItems(sampleBoard(), ["a"], 10, -5);
    expect(findItem(board, "a")).toMatchObject({ x: 10, y: -5 });
  });

  it("複数のアイテムを同時に動かす", () => {
    const board = moveItems(sampleBoard(), ["a", "c"], 10, 10);
    expect(findItem(board, "a")).toMatchObject({ x: 10, y: 10 });
    expect(findItem(board, "c")).toMatchObject({ x: 210, y: 10 });
  });

  it("指定外のアイテムは動かさない", () => {
    const board = moveItems(sampleBoard(), ["a"], 10, 10);
    expect(findItem(board, "b")).toMatchObject({ x: 100, y: 0 });
  });

  it("重なり順を保つ", () => {
    const board = moveItems(sampleBoard(), ["a"], 10, 10);
    expect(board.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("移動量が 0 なら元のボードをそのまま返す", () => {
    const board = sampleBoard();
    expect(moveItems(board, ["a"], 0, 0)).toBe(board);
  });

  it("対象が空なら元のボードをそのまま返す", () => {
    const board = sampleBoard();
    expect(moveItems(board, [], 10, 10)).toBe(board);
  });
});
