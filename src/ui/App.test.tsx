import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAX_SCALE, MIN_SCALE } from "../domain/viewport";
import { createBoardStore, type BoardStore } from "../store/boardStore";
import { stubCanvasContext } from "../test/mockCanvas";
import { stubLayout, type LayoutStub } from "../test/mockLayout";
import { App } from "./App";

let layout: LayoutStub;
let canvasStub: ReturnType<typeof stubCanvasContext>;
let store: BoardStore;

beforeEach(() => {
  layout = stubLayout({ width: 800, height: 600 });
  canvasStub = stubCanvasContext();
  let counter = 0;
  store = createBoardStore({ createId: () => `id-${(counter += 1)}` });
});

afterEach(() => {
  canvasStub.restore();
  layout.restore();
});

function renderApp() {
  return render(<App store={store} />);
}

/** 倍率表示（リセットボタン）のラベル。 */
function zoomLabel(): string {
  return screen.getByRole("button", { name: "表示倍率をリセット" })
    .textContent as string;
}

describe("App: 表示", () => {
  it("キャンバスを表示する", () => {
    renderApp();
    expect(screen.getByTestId("board-canvas")).toBeInTheDocument();
  });

  it("ツールバーを表示する", () => {
    renderApp();
    expect(
      screen.getByRole("toolbar", { name: "アイテムの追加" }),
    ).toBeInTheDocument();
  });

  it("既定のストアでも描画できる", () => {
    expect(() => render(<App />)).not.toThrow();
  });
});

describe("App: ズーム操作", () => {
  it("初期倍率は 100% を表示する", () => {
    renderApp();
    expect(zoomLabel()).toBe("100%");
  });

  it("拡大ボタンで倍率が上がる", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "拡大" }));
    expect(zoomLabel()).toBe("125%");
  });

  it("縮小ボタンで倍率が下がる", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "縮小" }));
    expect(zoomLabel()).toBe("80%");
  });

  it("倍率表示をクリックすると等倍に戻る", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "拡大" }));
    fireEvent.click(screen.getByRole("button", { name: "表示倍率をリセット" }));
    expect(zoomLabel()).toBe("100%");
  });

  it("拡大を繰り返しても上限を超えない", () => {
    renderApp();
    const zoomIn = screen.getByRole("button", { name: "拡大" });
    for (let i = 0; i < 30; i += 1) {
      fireEvent.click(zoomIn);
    }
    expect(zoomLabel()).toBe(`${MAX_SCALE * 100}%`);
  });

  it("縮小を繰り返しても下限を下回らない", () => {
    renderApp();
    const zoomOut = screen.getByRole("button", { name: "縮小" });
    for (let i = 0; i < 40; i += 1) {
      fireEvent.click(zoomOut);
    }
    expect(zoomLabel()).toBe(`${MIN_SCALE * 100}%`);
  });

  it("キャンバスのホイール操作が倍率表示に反映される", () => {
    renderApp();
    fireEvent.wheel(screen.getByTestId("board-canvas"), {
      deltaY: -100,
      ctrlKey: true,
    });
    expect(zoomLabel()).not.toBe("100%");
  });
});

describe("App: アイテムの追加", () => {
  it("付箋を追加する", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "青の付箋を追加" }));
    expect(store.getState().board.items).toMatchObject([
      { type: "sticky", color: "blue" },
    ]);
  });

  it("6 色すべての付箋を追加できる", () => {
    renderApp();
    for (const label of ["黄色", "オレンジ", "ピンク", "紫", "青", "緑"]) {
      fireEvent.click(
        screen.getByRole("button", { name: `${label}の付箋を追加` }),
      );
    }
    expect(store.getState().board.items).toHaveLength(6);
  });

  it("矩形を追加する", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "矩形" }));
    expect(store.getState().board.items).toMatchObject([
      { type: "shape", shape: "rectangle" },
    ]);
  });

  it("円を追加する", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "円" }));
    expect(store.getState().board.items).toMatchObject([
      { type: "shape", shape: "circle" },
    ]);
  });

  it("テキストを追加する", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "テキスト" }));
    expect(store.getState().board.items).toMatchObject([{ type: "text" }]);
  });

  it("見えている範囲の中央に追加する", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "矩形" }));
    // jsdom の既定ウィンドウは 1024x768、等倍なので中央は (512, 384)
    expect(store.getState().board.items[0]).toMatchObject({ x: 512, y: 384 });
  });

  it("続けて追加すると位置を少しずつずらす", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "矩形" }));
    fireEvent.click(screen.getByRole("button", { name: "矩形" }));
    const [first, second] = store.getState().board.items;
    expect(second?.x).toBeGreaterThan(first?.x ?? 0);
  });

  it("追加したアイテムは選択状態になる", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "矩形" }));
    expect(store.getState().selectedIds.size).toBe(1);
  });
});

describe("App: 選択と削除", () => {
  /** 付箋を 1 枚追加して選択を外した状態にする。 */
  function addStickyAndDeselect() {
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    // ストアを直接触る場合は React に再描画させる必要がある
    act(() => store.getState().clearSelection());
  }

  it("何も選択していなければ削除ボタンは無効", () => {
    renderApp();
    expect(screen.getByRole("button", { name: "削除" })).toBeDisabled();
  });

  it("選択すると削除ボタンが有効になる", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    expect(screen.getByRole("button", { name: "削除" })).toBeEnabled();
  });

  it("削除ボタンで選択中のアイテムを消す", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    expect(store.getState().board.items).toEqual([]);
  });

  it("Delete キーで選択中のアイテムを消す", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    fireEvent.keyDown(window, { key: "Delete" });
    expect(store.getState().board.items).toEqual([]);
  });

  it("キャンバス上のアイテムをクリックすると選択される", () => {
    renderApp();
    addStickyAndDeselect();
    const item = store.getState().board.items[0];
    fireEvent.pointerDown(screen.getByTestId("board-canvas"), {
      button: 0,
      clientX: (item?.x ?? 0) + 10,
      clientY: (item?.y ?? 0) + 10,
    });
    expect(store.getState().selectedIds.has(item?.id ?? "")).toBe(true);
  });

  it("Shift クリックで選択を切り替える", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    const item = store.getState().board.items[0];
    fireEvent.pointerDown(screen.getByTestId("board-canvas"), {
      button: 0,
      shiftKey: true,
      clientX: (item?.x ?? 0) + 10,
      clientY: (item?.y ?? 0) + 10,
    });
    expect(store.getState().selectedIds.size).toBe(0);
  });

  it("空白部分のクリックで選択が解除される", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    fireEvent.pointerDown(screen.getByTestId("board-canvas"), {
      button: 0,
      clientX: 5,
      clientY: 5,
    });
    expect(store.getState().selectedIds.size).toBe(0);
  });
});

describe("App: ドラッグ移動", () => {
  it("アイテムをドラッグすると位置が変わる", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    const before = store.getState().board.items[0];
    const canvas = screen.getByTestId("board-canvas");

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: (before?.x ?? 0) + 10,
      clientY: (before?.y ?? 0) + 10,
    });
    fireEvent.pointerMove(window, {
      clientX: (before?.x ?? 0) + 40,
      clientY: (before?.y ?? 0) + 30,
    });

    expect(store.getState().board.items[0]).toMatchObject({
      x: (before?.x ?? 0) + 30,
      y: (before?.y ?? 0) + 20,
    });
  });
});

describe("App: テキスト編集", () => {
  /** 付箋を 1 枚追加し、その画面上の中心座標を返す。 */
  function addStickyAndCenter() {
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    const item = store.getState().board.items[0];
    return {
      id: item?.id ?? "",
      x: (item?.x ?? 0) + (item?.width ?? 0) / 2,
      y: (item?.y ?? 0) + (item?.height ?? 0) / 2,
    };
  }

  it("ダブルクリックで編集欄が開く", () => {
    renderApp();
    const center = addStickyAndCenter();
    fireEvent.dblClick(screen.getByTestId("board-canvas"), {
      clientX: center.x,
      clientY: center.y,
    });
    expect(screen.getByLabelText("アイテムのテキスト")).toBeInTheDocument();
  });

  it("編集していないときは編集欄を出さない", () => {
    renderApp();
    expect(screen.queryByLabelText("アイテムのテキスト")).not.toBeInTheDocument();
  });

  it("入力するとアイテムのテキストが変わる", () => {
    renderApp();
    const center = addStickyAndCenter();
    fireEvent.dblClick(screen.getByTestId("board-canvas"), {
      clientX: center.x,
      clientY: center.y,
    });
    fireEvent.change(screen.getByLabelText("アイテムのテキスト"), {
      target: { value: "打ち合わせメモ" },
    });
    expect(store.getState().board.items[0]).toMatchObject({
      text: "打ち合わせメモ",
    });
  });

  it("Escape で編集欄が閉じる", () => {
    renderApp();
    const center = addStickyAndCenter();
    fireEvent.dblClick(screen.getByTestId("board-canvas"), {
      clientX: center.x,
      clientY: center.y,
    });
    fireEvent.keyDown(screen.getByLabelText("アイテムのテキスト"), {
      key: "Escape",
    });
    expect(screen.queryByLabelText("アイテムのテキスト")).not.toBeInTheDocument();
  });

  it("他のアイテムを選ぶと編集欄が閉じる", () => {
    renderApp();
    const center = addStickyAndCenter();
    fireEvent.dblClick(screen.getByTestId("board-canvas"), {
      clientX: center.x,
      clientY: center.y,
    });
    // 空白部分をクリックする
    fireEvent.pointerDown(screen.getByTestId("board-canvas"), {
      button: 0,
      clientX: 5,
      clientY: 5,
    });
    expect(screen.queryByLabelText("アイテムのテキスト")).not.toBeInTheDocument();
  });

  it("単体テキストも編集できる", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "テキスト" }));
    const item = store.getState().board.items[0];
    fireEvent.dblClick(screen.getByTestId("board-canvas"), {
      clientX: (item?.x ?? 0) + 10,
      clientY: (item?.y ?? 0) + 10,
    });
    expect(screen.getByLabelText("アイテムのテキスト")).toBeInTheDocument();
  });

  it("図形もテキストを編集できる", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "円" }));
    const item = store.getState().board.items[0];
    fireEvent.dblClick(screen.getByTestId("board-canvas"), {
      clientX: (item?.x ?? 0) + (item?.width ?? 0) / 2,
      clientY: (item?.y ?? 0) + (item?.height ?? 0) / 2,
    });
    expect(screen.getByLabelText("アイテムのテキスト")).toBeInTheDocument();
  });
});

describe("App: フォント設定", () => {
  it("テキストアイテムを選ぶとフォント設定が出る", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "テキスト" }));
    expect(
      screen.getByRole("group", { name: "テキストの設定" }),
    ).toBeInTheDocument();
  });

  it("付箋を選んでもフォント設定は出さない", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    expect(
      screen.queryByRole("group", { name: "テキストの設定" }),
    ).not.toBeInTheDocument();
  });

  it("何も選んでいなければ出さない", () => {
    renderApp();
    expect(
      screen.queryByRole("group", { name: "テキストの設定" }),
    ).not.toBeInTheDocument();
  });

  it("複数選択中は出さない", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "テキスト" }));
    fireEvent.click(screen.getByRole("button", { name: "テキスト" }));
    act(() =>
      store
        .getState()
        .selectMany(store.getState().board.items.map((item) => item.id)),
    );
    expect(
      screen.queryByRole("group", { name: "テキストの設定" }),
    ).not.toBeInTheDocument();
  });

  it("フォントを変えるとアイテムに反映される", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "テキスト" }));
    fireEvent.change(screen.getByLabelText("フォント"), {
      target: { value: "Menlo" },
    });
    expect(store.getState().board.items[0]).toMatchObject({
      fontFamily: "Menlo",
    });
  });

  it("サイズを変えるとアイテムに反映される", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "テキスト" }));
    fireEvent.change(screen.getByLabelText("サイズ"), {
      target: { value: "48" },
    });
    expect(store.getState().board.items[0]).toMatchObject({ fontSize: 48 });
  });
});
