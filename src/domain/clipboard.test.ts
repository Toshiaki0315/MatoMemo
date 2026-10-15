import { describe, expect, it } from "vitest";
import {
  createBoard,
  createConnector,
  createShape,
  createStickyNote,
} from "./board";
import { addConnector, addItem } from "./boardOps";
import { copyItems, pasteItems, PASTE_OFFSET } from "./clipboard";

/** a — b — c と付箋 3 枚を線で順につないだボード。 */
function chainBoard() {
  let board = createBoard({ id: "b" });
  board = addItem(board, createStickyNote({ id: "a", x: 0, y: 0, text: "課題" }));
  board = addItem(
    board,
    createShape({ id: "b", shape: "circle", x: 300, y: 0, text: "原因" }),
  );
  board = addItem(board, createStickyNote({ id: "c", x: 600, y: 0 }));
  board = addConnector(
    board,
    createConnector({ id: "ab", fromItemId: "a", toItemId: "b", endCap: "arrow" }),
  );
  return addConnector(
    board,
    createConnector({ id: "bc", fromItemId: "b", toItemId: "c" }),
  );
}

/** 決まった順に id を振る。 */
function sequentialIds() {
  let count = 0;
  return () => `new-${(count += 1)}`;
}

describe("copyItems", () => {
  it("選んだアイテムを重なり順のまま写す", () => {
    const content = copyItems(chainBoard(), ["c", "a"]);
    expect(content?.items.map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("選んだアイテム同士を結ぶ線も写す", () => {
    const content = copyItems(chainBoard(), ["a", "b"]);
    expect(content?.connectors.map((connector) => connector.id)).toEqual([
      "ab",
    ]);
  });

  it("片方の端しか選ばれていない線は写さない", () => {
    const content = copyItems(chainBoard(), ["a"]);
    expect(content?.connectors).toEqual([]);
  });

  it("何も選ばれていなければ null", () => {
    expect(copyItems(chainBoard(), [])).toBeNull();
    expect(copyItems(chainBoard(), ["missing"])).toBeNull();
  });
});

describe("pasteItems", () => {
  it("新しい id で複製し、ずらして最前面に置く", () => {
    const board = chainBoard();
    const content = copyItems(board, ["a"]);
    if (content === null) {
      throw new Error("コピーできませんでした");
    }
    const result = pasteItems(board, content, PASTE_OFFSET, sequentialIds());

    expect(result.ids).toEqual(["new-1"]);
    expect(result.board.items.at(-1)).toMatchObject({
      id: "new-1",
      type: "sticky",
      text: "課題",
      x: PASTE_OFFSET,
      y: PASTE_OFFSET,
    });
    // 元のアイテムはそのまま残る
    expect(result.board.items).toHaveLength(4);
  });

  it("写した線は複製したアイテム同士を結び直す", () => {
    const board = chainBoard();
    const content = copyItems(board, ["a", "b"]);
    if (content === null) {
      throw new Error("コピーできませんでした");
    }
    const result = pasteItems(board, content, 0, sequentialIds());
    expect(result.board.connectors.at(-1)).toMatchObject({
      id: "new-3",
      fromItemId: "new-1",
      toItemId: "new-2",
      // 線の見た目もそのまま写す
      endCap: "arrow",
    });
  });

  it("何度貼っても元のボードは変えない", () => {
    const board = chainBoard();
    const content = copyItems(board, ["a"]);
    if (content === null) {
      throw new Error("コピーできませんでした");
    }
    pasteItems(board, content, 0, sequentialIds());
    expect(board.items).toHaveLength(3);
  });

  it("繋ぐ相手のいない線は貼り付けない", () => {
    // copyItems は作らない形だが、外から渡された内容でも壊れないようにする
    const board = chainBoard();
    const result = pasteItems(
      board,
      {
        items: [board.items[0] as (typeof board.items)[number]],
        connectors: [board.connectors[1] as (typeof board.connectors)[number]],
      },
      0,
      sequentialIds(),
    );
    expect(result.board.connectors).toHaveLength(2);
  });
});
