import { describe, expect, it } from "vitest";
import { createShape, createStickyNote } from "../domain/board";
import { findItem } from "../domain/boardOps";
import { createViewport } from "../domain/viewport";
import { createBoardStore } from "./boardStore";

/** 連番の id を発行するストアを作る。 */
function setup() {
  let counter = 0;
  const store = createBoardStore({
    createId: () => `id-${(counter += 1)}`,
  });
  return store;
}

/** 付箋を 1 枚追加する。 */
function addSticky(
  store: ReturnType<typeof setup>,
  x: number,
  y: number,
): string {
  return store
    .getState()
    .addItem((id) => createStickyNote({ id, x, y, width: 100, height: 100 }));
}

describe("createBoardStore: 初期状態", () => {
  it("空のボードから始まる", () => {
    expect(setup().getState().board.items).toEqual([]);
  });

  it("等倍のビューポートから始まる", () => {
    expect(setup().getState().viewport).toEqual(createViewport());
  });

  it("何も選択されていない", () => {
    expect(setup().getState().selectedIds.size).toBe(0);
  });

  it("ボードには id が振られている", () => {
    expect(setup().getState().board.id).toBe("id-1");
  });
});

describe("setViewport", () => {
  it("ビューポートを差し替える", () => {
    const store = setup();
    store.getState().setViewport({ x: 10, y: 20, scale: 2 });
    expect(store.getState().viewport).toEqual({ x: 10, y: 20, scale: 2 });
  });
});

describe("addItem", () => {
  it("採番した id でアイテムを追加する", () => {
    const store = setup();
    const id = addSticky(store, 0, 0);
    expect(id).toBe("id-2");
    expect(store.getState().board.items).toHaveLength(1);
  });

  it("追加したアイテムを選択状態にする", () => {
    const store = setup();
    const id = addSticky(store, 0, 0);
    expect([...store.getState().selectedIds]).toEqual([id]);
  });

  it("最前面に積む", () => {
    const store = setup();
    addSticky(store, 0, 0);
    const second = addSticky(store, 10, 10);
    expect(store.getState().board.items.at(-1)?.id).toBe(second);
  });
});

describe("replaceItem", () => {
  it("アイテムを差し替える", () => {
    const store = setup();
    const id = addSticky(store, 0, 0);
    store
      .getState()
      .replaceItem(createStickyNote({ id, x: 50, y: 50, text: "更新" }));
    expect(findItem(store.getState().board, id)).toMatchObject({
      x: 50,
      text: "更新",
    });
  });
});

describe("選択の操作", () => {
  it("selectOnly は単一選択にする", () => {
    const store = setup();
    const first = addSticky(store, 0, 0);
    const second = addSticky(store, 10, 10);
    store.getState().selectOnly(first);
    expect([...store.getState().selectedIds]).toEqual([first]);
    expect(store.getState().selectedIds.has(second)).toBe(false);
  });

  it("toggleSelection は選択に追加する", () => {
    const store = setup();
    const first = addSticky(store, 0, 0);
    const second = addSticky(store, 10, 10);
    store.getState().selectOnly(first);
    store.getState().toggleSelection(second);
    expect(store.getState().selectedIds.size).toBe(2);
  });

  it("toggleSelection は選択済みなら外す", () => {
    const store = setup();
    const id = addSticky(store, 0, 0);
    store.getState().toggleSelection(id);
    expect(store.getState().selectedIds.has(id)).toBe(false);
  });

  it("selectMany は複数をまとめて選択する", () => {
    const store = setup();
    const first = addSticky(store, 0, 0);
    const second = addSticky(store, 10, 10);
    store.getState().selectMany([first, second]);
    expect(store.getState().selectedIds.size).toBe(2);
  });

  it("clearSelection は選択を解除する", () => {
    const store = setup();
    addSticky(store, 0, 0);
    store.getState().clearSelection();
    expect(store.getState().selectedIds.size).toBe(0);
  });
});

describe("moveSelected", () => {
  it("選択中のアイテムを動かす", () => {
    const store = setup();
    const id = addSticky(store, 0, 0);
    store.getState().moveSelected(10, -5);
    expect(findItem(store.getState().board, id)).toMatchObject({
      x: 10,
      y: -5,
    });
  });

  it("選択外のアイテムは動かさない", () => {
    const store = setup();
    const first = addSticky(store, 0, 0);
    const second = addSticky(store, 100, 0);
    store.getState().selectOnly(second);
    store.getState().moveSelected(10, 10);
    expect(findItem(store.getState().board, first)).toMatchObject({
      x: 0,
      y: 0,
    });
  });

  it("何も選択していなければ何も起きない", () => {
    const store = setup();
    addSticky(store, 0, 0);
    store.getState().clearSelection();
    const before = store.getState().board;
    store.getState().moveSelected(10, 10);
    expect(store.getState().board).toBe(before);
  });
});

describe("removeSelected", () => {
  it("選択中のアイテムを削除する", () => {
    const store = setup();
    addSticky(store, 0, 0);
    store.getState().removeSelected();
    expect(store.getState().board.items).toEqual([]);
  });

  it("削除後は選択を解除する", () => {
    const store = setup();
    addSticky(store, 0, 0);
    store.getState().removeSelected();
    expect(store.getState().selectedIds.size).toBe(0);
  });

  it("選択外のアイテムは残す", () => {
    const store = setup();
    const first = addSticky(store, 0, 0);
    const second = addSticky(store, 100, 0);
    store.getState().selectOnly(second);
    store.getState().removeSelected();
    expect(store.getState().board.items.map((item) => item.id)).toEqual([first]);
  });

  it("何も選択していなければ何も起きない", () => {
    const store = setup();
    addSticky(store, 0, 0);
    store.getState().clearSelection();
    const before = store.getState().board;
    store.getState().removeSelected();
    expect(store.getState().board).toBe(before);
  });
});

describe("selectedItems", () => {
  it("選択中のアイテムを重なり順で返す", () => {
    const store = setup();
    const first = addSticky(store, 0, 0);
    const second = addSticky(store, 100, 0);
    store.getState().selectMany([second, first]);
    expect(store.getState().selectedItems().map((item) => item.id)).toEqual([
      first,
      second,
    ]);
  });

  it("選択がなければ空を返す", () => {
    expect(setup().getState().selectedItems()).toEqual([]);
  });
});

describe("既定の id 生成", () => {
  it("createId を省略すると UUID が使われる", () => {
    const store = createBoardStore();
    store.getState().addItem((id) => createShape({ id, shape: "circle", x: 0, y: 0 }));
    expect(store.getState().board.items[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
