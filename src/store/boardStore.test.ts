import { describe, expect, it } from "vitest";
import {
  createBoard,
  createImage,
  createShape,
  createStickyNote,
} from "../domain/board";
import { findItem } from "../domain/boardOps";
import { createViewport } from "../domain/viewport";
import { createBoardStore, HISTORY_LIMIT } from "./boardStore";

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

describe("重なり順の操作", () => {
  /** 付箋を 3 枚追加し、その id を背面→前面の順で返す。 */
  function setupThree() {
    const store = setup();
    const ids = [
      addSticky(store, 0, 0),
      addSticky(store, 10, 10),
      addSticky(store, 20, 20),
    ];
    return { store, ids };
  }

  /** 現在の並びを id の配列で返す。 */
  function order(store: ReturnType<typeof setup>): string[] {
    return store.getState().board.items.map((item) => item.id);
  }

  it("最前面へ移す", () => {
    const { store, ids } = setupThree();
    store.getState().selectOnly(ids[0] as string);
    store.getState().bringSelectedToFront();
    expect(order(store)).toEqual([ids[1], ids[2], ids[0]]);
  });

  it("最背面へ移す", () => {
    const { store, ids } = setupThree();
    store.getState().selectOnly(ids[2] as string);
    store.getState().sendSelectedToBack();
    expect(order(store)).toEqual([ids[2], ids[0], ids[1]]);
  });

  it("一つ手前へ移す", () => {
    const { store, ids } = setupThree();
    store.getState().selectOnly(ids[0] as string);
    store.getState().bringSelectedForward();
    expect(order(store)).toEqual([ids[1], ids[0], ids[2]]);
  });

  it("一つ奥へ移す", () => {
    const { store, ids } = setupThree();
    store.getState().selectOnly(ids[2] as string);
    store.getState().sendSelectedBackward();
    expect(order(store)).toEqual([ids[0], ids[2], ids[1]]);
  });

  it("並びが変わらない操作ではボードの参照を変えない", () => {
    const { store, ids } = setupThree();
    store.getState().selectOnly(ids[2] as string);
    const before = store.getState().board;
    store.getState().bringSelectedToFront();
    store.getState().bringSelectedForward();
    expect(store.getState().board).toBe(before);
  });

  it("何も選択していなければ何も起きない", () => {
    const { store } = setupThree();
    store.getState().clearSelection();
    const before = store.getState().board;
    store.getState().bringSelectedToFront();
    store.getState().sendSelectedToBack();
    store.getState().bringSelectedForward();
    store.getState().sendSelectedBackward();
    expect(store.getState().board).toBe(before);
  });
});

describe("resizeItem", () => {
  it("南東のハンドルでサイズを変える", () => {
    const store = setup();
    const id = addSticky(store, 0, 0);
    store.getState().resizeItem(id, "se", 50, 20);
    expect(findItem(store.getState().board, id)).toMatchObject({
      x: 0,
      y: 0,
      width: 150,
      height: 120,
    });
  });

  it("北西のハンドルでは位置も変わる", () => {
    const store = setup();
    const id = addSticky(store, 100, 100);
    store.getState().resizeItem(id, "nw", 20, 20);
    expect(findItem(store.getState().board, id)).toMatchObject({
      x: 120,
      y: 120,
      width: 80,
      height: 80,
    });
  });

  it("存在しない id は無視する", () => {
    const store = setup();
    addSticky(store, 0, 0);
    const before = store.getState().board;
    store.getState().resizeItem("zzz", "se", 10, 10);
    expect(store.getState().board).toBe(before);
  });

  it("付箋は縦横比を保たない（自由にリサイズできる）", () => {
    const store = setup();
    const id = addSticky(store, 0, 0);
    store.getState().resizeItem(id, "se", 100, 0);
    expect(findItem(store.getState().board, id)).toMatchObject({
      width: 200,
      height: 100,
    });
  });
});

describe("resizeItem: 画像の縦横比維持", () => {
  /** 原寸 200x100（比 2:1）の画像を追加する。 */
  function addImage(store: ReturnType<typeof setup>): string {
    return store.getState().addItem((id) =>
      createImage({
        id,
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        source: "data:image/png;base64,AA",
        naturalWidth: 200,
        naturalHeight: 100,
      }),
    );
  }

  it("横に引いても縦横比を保つ", () => {
    const store = setup();
    const id = addImage(store);
    store.getState().resizeItem(id, "se", 200, 0);
    const item = findItem(store.getState().board, id);
    expect(item).toMatchObject({ width: 400, height: 200 });
  });

  it("縦に引いても縦横比を保つ", () => {
    const store = setup();
    const id = addImage(store);
    store.getState().resizeItem(id, "s", 0, 100);
    const item = findItem(store.getState().board, id);
    expect((item?.width ?? 0) / (item?.height ?? 1)).toBeCloseTo(2, 10);
  });

  it("角を斜めに引いても縦横比を保つ", () => {
    const store = setup();
    const id = addImage(store);
    store.getState().resizeItem(id, "se", 137, -42);
    const item = findItem(store.getState().board, id);
    expect((item?.width ?? 0) / (item?.height ?? 1)).toBeCloseTo(2, 10);
  });

  it("何度リサイズしても原寸の比から離れない", () => {
    const store = setup();
    const id = addImage(store);
    for (const [dx, dy] of [
      [37, -11],
      [-58, 23],
      [91, 64],
      [-12, -77],
    ]) {
      store.getState().resizeItem(id, "se", dx as number, dy as number);
    }
    const item = findItem(store.getState().board, id);
    expect((item?.width ?? 0) / (item?.height ?? 1)).toBeCloseTo(2, 10);
  });

  it("極端に縮めても縦横比を保つ", () => {
    const store = setup();
    const id = addImage(store);
    store.getState().resizeItem(id, "nw", 1000, 1000);
    const item = findItem(store.getState().board, id);
    expect((item?.width ?? 0) / (item?.height ?? 1)).toBeCloseTo(2, 10);
  });

  it("原寸そのものは変わらない", () => {
    const store = setup();
    const id = addImage(store);
    store.getState().resizeItem(id, "se", 300, 300);
    expect(findItem(store.getState().board, id)).toMatchObject({
      naturalWidth: 200,
      naturalHeight: 100,
    });
  });
});

describe("connectItems", () => {
  /** 付箋を 2 枚追加してその id を返す。 */
  function setupTwo() {
    const store = setup();
    return { store, ids: [addSticky(store, 0, 0), addSticky(store, 300, 0)] };
  }

  it("コネクタを追加する", () => {
    const { store, ids } = setupTwo();
    const id = store
      .getState()
      .connectItems(ids[0] as string, ids[1] as string, "straight");
    expect(id).not.toBeNull();
    expect(store.getState().board.connectors).toMatchObject([
      { fromItemId: ids[0], toItemId: ids[1], kind: "straight" },
    ]);
  });

  it("種類を指定できる", () => {
    const { store, ids } = setupTwo();
    store.getState().connectItems(ids[0] as string, ids[1] as string, "curved");
    expect(store.getState().board.connectors[0]?.kind).toBe("curved");
  });

  it("自分自身への接続は作らない", () => {
    const { store, ids } = setupTwo();
    expect(
      store.getState().connectItems(ids[0] as string, ids[0] as string, "straight"),
    ).toBeNull();
    expect(store.getState().board.connectors).toEqual([]);
  });

  it("同じ組み合わせを二重に作らない", () => {
    const { store, ids } = setupTwo();
    store.getState().connectItems(ids[0] as string, ids[1] as string, "straight");
    expect(
      store.getState().connectItems(ids[0] as string, ids[1] as string, "curved"),
    ).toBeNull();
    expect(store.getState().board.connectors).toHaveLength(1);
  });

  it("向きが逆でも二重に作らない", () => {
    const { store, ids } = setupTwo();
    store.getState().connectItems(ids[0] as string, ids[1] as string, "straight");
    expect(
      store.getState().connectItems(ids[1] as string, ids[0] as string, "straight"),
    ).toBeNull();
  });
});

describe("removeConnector", () => {
  it("指定したコネクタを取り除く", () => {
    const store = setup();
    const a = addSticky(store, 0, 0);
    const b = addSticky(store, 300, 0);
    const id = store.getState().connectItems(a, b, "straight") as string;
    store.getState().removeConnector(id);
    expect(store.getState().board.connectors).toEqual([]);
  });

  it("アイテムは消さない", () => {
    const store = setup();
    const a = addSticky(store, 0, 0);
    const b = addSticky(store, 300, 0);
    const id = store.getState().connectItems(a, b, "straight") as string;
    store.getState().removeConnector(id);
    expect(store.getState().board.items).toHaveLength(2);
  });
});

describe("アイテム削除とコネクタ", () => {
  it("アイテムを消すと繋がるコネクタも消える", () => {
    const store = setup();
    const a = addSticky(store, 0, 0);
    const b = addSticky(store, 300, 0);
    store.getState().connectItems(a, b, "straight");
    store.getState().selectOnly(a);
    store.getState().removeSelected();
    expect(store.getState().board.connectors).toEqual([]);
    expect(store.getState().board.items).toHaveLength(1);
  });
});

describe("ファイルの状態", () => {
  it("最初は保存先を持たない", () => {
    expect(setup().getState().filePath).toBeNull();
  });

  it("最初は未保存の変更が無い", () => {
    expect(setup().getState().isDirty()).toBe(false);
  });

  it("アイテムを追加すると未保存になる", () => {
    const store = setup();
    addSticky(store, 0, 0);
    expect(store.getState().isDirty()).toBe(true);
  });

  it("選択を変えただけでは未保存にならない", () => {
    const store = setup();
    store.getState().clearSelection();
    store.getState().selectMany([]);
    expect(store.getState().isDirty()).toBe(false);
  });

  it("ビューポートを変えただけでは未保存にならない", () => {
    const store = setup();
    store.getState().setViewport({ x: 10, y: 10, scale: 2 });
    expect(store.getState().isDirty()).toBe(false);
  });

  it("何も変えない操作では未保存にならない", () => {
    const store = setup();
    store.getState().moveSelected(0, 0);
    store.getState().bringSelectedToFront();
    expect(store.getState().isDirty()).toBe(false);
  });

  it("保存すると未保存でなくなる", () => {
    const store = setup();
    addSticky(store, 0, 0);
    store.getState().markSaved("/tmp/a.matomemo");
    expect(store.getState().isDirty()).toBe(false);
    expect(store.getState().filePath).toBe("/tmp/a.matomemo");
  });

  it("保存後に変更すると再び未保存になる", () => {
    const store = setup();
    store.getState().markSaved("/tmp/a.matomemo");
    addSticky(store, 0, 0);
    expect(store.getState().isDirty()).toBe(true);
  });
});

describe("renameBoard", () => {
  it("名前を変える", () => {
    const store = setup();
    store.getState().renameBoard("設計メモ");
    expect(store.getState().board.name).toBe("設計メモ");
  });

  it("名前の変更も未保存の変更に数える", () => {
    const store = setup();
    store.getState().renameBoard("設計メモ");
    expect(store.getState().isDirty()).toBe(true);
  });
});

describe("openBoard", () => {
  /** 付箋を 1 枚持つ読み込み済みボード。 */
  function loadedBoard() {
    return {
      ...createBoard({ id: "loaded" }),
      items: [createStickyNote({ id: "x", x: 5, y: 5 })],
    };
  }

  it("ボードを置き換える", () => {
    const store = setup();
    store.getState().openBoard(loadedBoard(), "/tmp/a.matomemo");
    expect(store.getState().board.id).toBe("loaded");
    expect(store.getState().board.items).toHaveLength(1);
  });

  it("保存先を記録し、未保存でない状態にする", () => {
    const store = setup();
    store.getState().openBoard(loadedBoard(), "/tmp/a.matomemo");
    expect(store.getState().filePath).toBe("/tmp/a.matomemo");
    expect(store.getState().isDirty()).toBe(false);
  });

  it("選択と表示位置を初期化する", () => {
    const store = setup();
    addSticky(store, 0, 0);
    store.getState().setViewport({ x: 50, y: 50, scale: 3 });
    store.getState().openBoard(loadedBoard(), "/tmp/a.matomemo");
    expect(store.getState().selectedIds.size).toBe(0);
    expect(store.getState().viewport).toEqual(createViewport());
  });
});

describe("newBoard", () => {
  it("空のボードにする", () => {
    const store = setup();
    addSticky(store, 0, 0);
    store.getState().newBoard();
    expect(store.getState().board.items).toEqual([]);
  });

  it("保存先を忘れ、未保存でない状態にする", () => {
    const store = setup();
    store.getState().markSaved("/tmp/a.matomemo");
    store.getState().newBoard();
    expect(store.getState().filePath).toBeNull();
    expect(store.getState().isDirty()).toBe(false);
  });

  it("選択と表示位置を初期化する", () => {
    const store = setup();
    addSticky(store, 0, 0);
    store.getState().setViewport({ x: 50, y: 50, scale: 3 });
    store.getState().newBoard();
    expect(store.getState().selectedIds.size).toBe(0);
    expect(store.getState().viewport).toEqual(createViewport());
  });
});

describe("元に戻す / やり直す", () => {
  it("最初は何も戻せない", () => {
    const store = setup();
    expect(store.getState().canUndo()).toBe(false);
    expect(store.getState().canRedo()).toBe(false);
  });

  it("アイテムの追加を取り消せる", () => {
    const store = setup();
    addSticky(store, 0, 0);
    store.getState().undo();
    expect(store.getState().board.items).toEqual([]);
  });

  it("取り消した操作をやり直せる", () => {
    const store = setup();
    const id = addSticky(store, 0, 0);
    store.getState().undo();
    store.getState().redo();
    expect(store.getState().board.items.map((item) => item.id)).toEqual([id]);
  });

  it("複数の操作を順に取り消せる", () => {
    const store = setup();
    addSticky(store, 0, 0);
    addSticky(store, 100, 0);
    store.getState().undo();
    expect(store.getState().board.items).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().board.items).toEqual([]);
  });

  it("戻せるものが無ければ何も起きない", () => {
    const store = setup();
    const before = store.getState().board;
    store.getState().undo();
    expect(store.getState().board).toBe(before);
  });

  it("やり直せるものが無ければ何も起きない", () => {
    const store = setup();
    const before = store.getState().board;
    store.getState().redo();
    expect(store.getState().board).toBe(before);
  });

  it("取り消した後に新しい操作をするとやり直せなくなる", () => {
    const store = setup();
    addSticky(store, 0, 0);
    store.getState().undo();
    expect(store.getState().canRedo()).toBe(true);
    addSticky(store, 50, 50);
    expect(store.getState().canRedo()).toBe(false);
  });

  it("削除も取り消せる", () => {
    const store = setup();
    const id = addSticky(store, 0, 0);
    store.getState().removeSelected();
    store.getState().undo();
    expect(store.getState().board.items.map((item) => item.id)).toEqual([id]);
  });

  it("移動も取り消せる", () => {
    const store = setup();
    const id = addSticky(store, 0, 0);
    store.getState().moveSelected(50, 50);
    store.getState().undo();
    expect(findItem(store.getState().board, id)).toMatchObject({ x: 0, y: 0 });
  });

  it("重なり順の変更も取り消せる", () => {
    const store = setup();
    const first = addSticky(store, 0, 0);
    const second = addSticky(store, 100, 0);
    store.getState().selectOnly(first);
    store.getState().bringSelectedToFront();
    store.getState().undo();
    expect(store.getState().board.items.map((item) => item.id)).toEqual([
      first,
      second,
    ]);
  });

  it("コネクタの追加も取り消せる", () => {
    const store = setup();
    const a = addSticky(store, 0, 0);
    const b = addSticky(store, 300, 0);
    store.getState().connectItems(a, b, "straight");
    store.getState().undo();
    expect(store.getState().board.connectors).toEqual([]);
  });

  it("名前の変更も取り消せる", () => {
    const store = setup();
    store.getState().renameBoard("設計メモ");
    store.getState().undo();
    expect(store.getState().board.name).toBe("無題のボード");
  });

  it("選択やズームは履歴に積まない", () => {
    const store = setup();
    store.getState().selectMany([]);
    store.getState().setViewport({ x: 10, y: 10, scale: 2 });
    expect(store.getState().canUndo()).toBe(false);
  });

  it("取り消しで消えたアイテムを選択したままにしない", () => {
    const store = setup();
    const id = addSticky(store, 0, 0);
    expect(store.getState().selectedIds.has(id)).toBe(true);
    store.getState().undo();
    expect(store.getState().selectedIds.size).toBe(0);
  });

  it("やり直しでも存在しないアイテムを選択したままにしない", () => {
    const store = setup();
    const first = addSticky(store, 0, 0);
    store.getState().removeSelected();
    store.getState().undo();
    store.getState().selectOnly(first);
    store.getState().redo();
    expect(store.getState().selectedIds.size).toBe(0);
  });

  it("残っているアイテムの選択は保つ", () => {
    const store = setup();
    const first = addSticky(store, 0, 0);
    addSticky(store, 100, 0);
    store.getState().selectOnly(first);
    store.getState().moveSelected(10, 10);
    store.getState().undo();
    expect(store.getState().selectedIds.has(first)).toBe(true);
  });

  it("履歴の上限を超えたら古いものから捨てる", () => {
    const store = setup();
    for (let i = 0; i < HISTORY_LIMIT + 10; i += 1) {
      addSticky(store, i, 0);
    }
    expect(store.getState().past).toHaveLength(HISTORY_LIMIT);
  });

  it("読み込むと履歴が消える", () => {
    const store = setup();
    addSticky(store, 0, 0);
    store.getState().openBoard(createBoard({ id: "loaded" }), "/tmp/a");
    expect(store.getState().canUndo()).toBe(false);
    expect(store.getState().canRedo()).toBe(false);
  });

  it("新規にすると履歴が消える", () => {
    const store = setup();
    addSticky(store, 0, 0);
    store.getState().newBoard();
    expect(store.getState().canUndo()).toBe(false);
  });
});

describe("履歴のまとめ (ドラッグ)", () => {
  it("まとめている間の変更は 1 回で戻る", () => {
    const store = setup();
    const id = addSticky(store, 0, 0);

    store.getState().beginHistoryGroup();
    store.getState().moveSelected(10, 0);
    store.getState().moveSelected(10, 0);
    store.getState().moveSelected(10, 0);
    store.getState().endHistoryGroup();

    expect(findItem(store.getState().board, id)).toMatchObject({ x: 30 });
    store.getState().undo();
    expect(findItem(store.getState().board, id)).toMatchObject({ x: 0 });
  });

  it("まとめの前の操作は別の取り消し単位のまま", () => {
    const store = setup();
    const id = addSticky(store, 0, 0);
    store.getState().beginHistoryGroup();
    store.getState().moveSelected(30, 0);
    store.getState().endHistoryGroup();

    store.getState().undo();
    expect(findItem(store.getState().board, id)).toMatchObject({ x: 0 });
    store.getState().undo();
    expect(store.getState().board.items).toEqual([]);
  });

  it("何も変わらなかったまとめは履歴に残さない", () => {
    const store = setup();
    addSticky(store, 0, 0);
    const before = store.getState().past.length;

    store.getState().beginHistoryGroup();
    store.getState().moveSelected(0, 0);
    store.getState().endHistoryGroup();

    expect(store.getState().past).toHaveLength(before);
  });

  it("二重に開始しても履歴は 1 件しか積まない", () => {
    const store = setup();
    addSticky(store, 0, 0);
    const before = store.getState().past.length;

    store.getState().beginHistoryGroup();
    store.getState().beginHistoryGroup();
    store.getState().moveSelected(10, 0);
    store.getState().endHistoryGroup();

    expect(store.getState().past).toHaveLength(before + 1);
  });

  it("開始していないのに終了しても何も起きない", () => {
    const store = setup();
    addSticky(store, 0, 0);
    const before = store.getState().past;
    store.getState().endHistoryGroup();
    expect(store.getState().past).toBe(before);
  });

  it("まとめの開始はやり直しを打ち切る", () => {
    const store = setup();
    addSticky(store, 0, 0);
    store.getState().undo();
    expect(store.getState().canRedo()).toBe(true);
    store.getState().beginHistoryGroup();
    expect(store.getState().canRedo()).toBe(false);
  });
});
