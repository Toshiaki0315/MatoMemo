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

/** ウィンドウの閉じる要求は購読しない（Tauri に依存しないため）。 */
const noopCloseGuard = async () => () => {};

function renderApp() {
  return render(<App store={store} closeGuard={noopCloseGuard} />);
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
    expect(() => render(<App closeGuard={noopCloseGuard} />)).not.toThrow();
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

  it("付箋を選ぶと配置もフォントも設定できる", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    expect(screen.getByLabelText("横位置")).toBeInTheDocument();
    expect(screen.getByLabelText("フォント")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("サイズ"), {
      target: { value: "32" },
    });
    expect(store.getState().board.items[0]).toMatchObject({ fontSize: 32 });
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

describe("App: 画像の取り込み", () => {
  const imported = {
    source: "data:image/png;base64,AAA",
    naturalWidth: 200,
    naturalHeight: 100,
  };

  function renderWithPicker(picker: () => Promise<typeof imported | null>) {
    return render(
      <App store={store} imagePicker={picker} closeGuard={noopCloseGuard} />,
    );
  }

  it("選んだ画像をアイテムとして追加する", async () => {
    renderWithPicker(async () => imported);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "画像" }));
    });
    expect(store.getState().board.items).toMatchObject([
      { type: "image", naturalWidth: 200, naturalHeight: 100 },
    ]);
  });

  it("原寸の縦横比を保った表示サイズで追加する", async () => {
    renderWithPicker(async () => imported);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "画像" }));
    });
    const item = store.getState().board.items[0];
    expect((item?.width ?? 0) / (item?.height ?? 1)).toBeCloseTo(2, 10);
  });

  it("キャンセルされたら何も追加しない", async () => {
    renderWithPicker(async () => null);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "画像" }));
    });
    expect(store.getState().board.items).toEqual([]);
  });

  it("失敗したらメッセージを出す", async () => {
    renderWithPicker(async () => {
      throw new Error("対応していない画像形式です。");
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "画像" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "対応していない画像形式です。",
    );
  });

  it("Error 以外が投げられても既定のメッセージを出す", async () => {
    renderWithPicker(async () => {
      throw "文字列";
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "画像" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "画像を取り込めませんでした。",
    );
  });

  it("メッセージを閉じられる", async () => {
    renderWithPicker(async () => {
      throw new Error("失敗しました。");
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "画像" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("画像アイテムはダブルクリックしても編集欄を出さない", async () => {
    renderWithPicker(async () => imported);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "画像" }));
    });
    const item = store.getState().board.items[0];
    fireEvent.dblClick(screen.getByTestId("board-canvas"), {
      clientX: (item?.x ?? 0) + 10,
      clientY: (item?.y ?? 0) + 10,
    });
    expect(screen.queryByLabelText("アイテムのテキスト")).not.toBeInTheDocument();
  });

  it("既定では実際の画像ピッカーを使う", () => {
    expect(() =>
      render(<App store={store} closeGuard={noopCloseGuard} />),
    ).not.toThrow();
  });
});

describe("App: 重なり順の変更", () => {
  /** 付箋を 3 枚追加する。 */
  function addThree() {
    for (let i = 0; i < 3; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    }
    return store.getState().board.items.map((item) => item.id);
  }

  /**
   * 指定したアイテムを右クリックする。
   *
   * 追加のたびに位置がずれる（カスケード）ので、次のアイテムに覆われて
   * いない左上寄りの点を狙う。中心はすべてのアイテムが重なるため、
   * 常に最前面が当たってしまう。
   */
  function rightClickItem(index: number) {
    const item = store.getState().board.items[index];
    fireEvent.contextMenu(screen.getByTestId("board-canvas"), {
      clientX: (item?.x ?? 0) + 10,
      clientY: (item?.y ?? 0) + 10,
    });
  }

  /** 現在の並びを id の配列で返す。 */
  function order(): string[] {
    return store.getState().board.items.map((item) => item.id);
  }

  it("右クリックでメニューが出る", () => {
    renderApp();
    addThree();
    rightClickItem(2);
    expect(screen.getByRole("menu", { name: "アイテムの操作" })).toBeInTheDocument();
  });

  it("空白部分の右クリックではメニューを出さない", () => {
    renderApp();
    addThree();
    fireEvent.contextMenu(screen.getByTestId("board-canvas"), {
      clientX: 5,
      clientY: 5,
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("未選択のアイテムを右クリックするとそのアイテムが対象になる", () => {
    renderApp();
    const ids = addThree();
    // 最前面の付箋が選択されている状態で、最背面を右クリックする
    rightClickItem(0);
    expect(store.getState().selectedIds).toEqual(new Set([ids[0]]));
  });

  it("最前面へ移動できる", () => {
    renderApp();
    const ids = addThree();
    rightClickItem(0);
    fireEvent.click(screen.getByRole("menuitem", { name: "最前面へ移動" }));
    expect(order()).toEqual([ids[1], ids[2], ids[0]]);
  });

  it("最背面へ移動できる", () => {
    renderApp();
    const ids = addThree();
    rightClickItem(2);
    fireEvent.click(screen.getByRole("menuitem", { name: "最背面へ移動" }));
    expect(order()).toEqual([ids[2], ids[0], ids[1]]);
  });

  it("一つ手前へ移動できる", () => {
    renderApp();
    const ids = addThree();
    rightClickItem(0);
    fireEvent.click(screen.getByRole("menuitem", { name: "一つ手前へ" }));
    expect(order()).toEqual([ids[1], ids[0], ids[2]]);
  });

  it("一つ奥へ移動できる", () => {
    renderApp();
    const ids = addThree();
    rightClickItem(2);
    fireEvent.click(screen.getByRole("menuitem", { name: "一つ奥へ" }));
    expect(order()).toEqual([ids[0], ids[2], ids[1]]);
  });

  it("メニューから削除できる", () => {
    renderApp();
    addThree();
    rightClickItem(2);
    fireEvent.click(screen.getByRole("menuitem", { name: "削除" }));
    expect(store.getState().board.items).toHaveLength(2);
  });

  it("操作するとメニューが閉じる", () => {
    renderApp();
    addThree();
    rightClickItem(0);
    fireEvent.click(screen.getByRole("menuitem", { name: "最前面へ移動" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("キャンバスを触るとメニューが閉じる", () => {
    renderApp();
    addThree();
    rightClickItem(0);
    fireEvent.pointerDown(screen.getByTestId("board-canvas"), {
      button: 0,
      clientX: 5,
      clientY: 5,
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("右クリック時はテキスト編集を終える", () => {
    renderApp();
    addThree();
    const item = store.getState().board.items[2];
    fireEvent.dblClick(screen.getByTestId("board-canvas"), {
      clientX: (item?.x ?? 0) + 10,
      clientY: (item?.y ?? 0) + 10,
    });
    rightClickItem(2);
    expect(screen.queryByLabelText("アイテムのテキスト")).not.toBeInTheDocument();
  });
});

describe("App: リサイズ", () => {
  it("ハンドルをドラッグするとサイズが変わる", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    const before = store.getState().board.items[0];
    const canvas = screen.getByTestId("board-canvas");

    // 南東のハンドル
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: (before?.x ?? 0) + (before?.width ?? 0),
      clientY: (before?.y ?? 0) + (before?.height ?? 0),
    });
    fireEvent.pointerMove(window, {
      clientX: (before?.x ?? 0) + (before?.width ?? 0) + 50,
      clientY: (before?.y ?? 0) + (before?.height ?? 0) + 30,
    });

    expect(store.getState().board.items[0]).toMatchObject({
      width: (before?.width ?? 0) + 50,
      height: (before?.height ?? 0) + 30,
    });
  });
});

describe("App: コネクタ", () => {
  /** 離れた場所に付箋を 2 枚置く。 */
  function addTwoStickies() {
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    const first = store.getState().board.items[0];
    fireEvent.click(screen.getByRole("button", { name: "青の付箋を追加" }));
    // 2 枚目を真横に大きく離す。高さを揃えることで線が水平になり、
    // 線の上の点をテストから簡単に指定できる。
    act(() => {
      const second = store.getState().board.items[1];
      if (second !== undefined) {
        store.getState().replaceItem({
          ...second,
          x: (first?.x ?? 0) + 400,
          y: first?.y ?? 0,
        });
      }
    });
    // 選択を外しておく。選択したまま接続モードに入ると、そのアイテムが
    // 始点として引き継がれる（その挙動は別の describe で確かめる）。
    act(() => store.getState().clearSelection());
    return store.getState().board.items.map((item) => item.id);
  }

  /** アイテムの左上寄りをクリックする。 */
  function clickItem(index: number) {
    const item = store.getState().board.items[index];
    fireEvent.pointerDown(screen.getByTestId("board-canvas"), {
      button: 0,
      clientX: (item?.x ?? 0) + 10,
      clientY: (item?.y ?? 0) + 10,
    });
  }

  it("接続モードを切り替えられる", () => {
    renderApp();
    const button = screen.getByRole("button", { name: "接続" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("2 つのアイテムを順にクリックすると線がつながる", () => {
    renderApp();
    const ids = addTwoStickies();
    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    clickItem(0);
    clickItem(1);
    expect(store.getState().board.connectors).toMatchObject([
      { fromItemId: ids[0], toItemId: ids[1], kind: "straight" },
    ]);
  });

  it("線の種類を選べる", () => {
    renderApp();
    addTwoStickies();
    fireEvent.change(screen.getByLabelText("線の種類"), {
      target: { value: "curved" },
    });
    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    clickItem(0);
    clickItem(1);
    expect(store.getState().board.connectors[0]?.kind).toBe("curved");
  });

  it("折れ線も選べる", () => {
    renderApp();
    addTwoStickies();
    fireEvent.change(screen.getByLabelText("線の種類"), {
      target: { value: "polyline" },
    });
    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    clickItem(0);
    clickItem(1);
    expect(store.getState().board.connectors[0]?.kind).toBe("polyline");
  });

  it("同じアイテムを 2 回クリックしても線はできない", () => {
    renderApp();
    addTwoStickies();
    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    clickItem(0);
    clickItem(0);
    expect(store.getState().board.connectors).toEqual([]);
  });

  it("つなぐと接続モードが自動で終わる", () => {
    renderApp();
    addTwoStickies();
    const button = screen.getByRole("button", { name: "接続" });
    fireEvent.click(button);
    clickItem(0);
    // 始点を選んだだけではモードを保つ
    expect(button).toHaveAttribute("aria-pressed", "true");
    clickItem(1);
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("線を引けなかったときはモードを保つ", () => {
    renderApp();
    addTwoStickies();
    const button = screen.getByRole("button", { name: "接続" });
    fireEvent.click(button);
    // 同じアイテムを 2 回クリックしても線はできず、モードは終わらない
    clickItem(0);
    clickItem(0);
    expect(button).toHaveAttribute("aria-pressed", "true");
    // そのまま選び直して線を引ける
    clickItem(0);
    clickItem(1);
    expect(store.getState().board.connectors).toHaveLength(1);
  });

  it("続けて別の線を引くには接続を押し直す", () => {
    renderApp();
    addTwoStickies();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    act(() => {
      const third = store.getState().board.items[2];
      if (third !== undefined) {
        store.getState().replaceItem({ ...third, x: 0, y: 0 });
      }
      store.getState().clearSelection();
    });
    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    clickItem(0);
    clickItem(1);
    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    clickItem(1);
    clickItem(2);
    expect(store.getState().board.connectors).toHaveLength(2);
  });

  it("接続モードを終えると選択が解除される", () => {
    renderApp();
    addTwoStickies();
    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    expect(store.getState().selectedIds.size).toBe(0);
  });

  it("アイテムを消すと繋がる線も消える", () => {
    renderApp();
    addTwoStickies();
    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    clickItem(0);
    clickItem(1);
    clickItem(0);
    fireEvent.keyDown(window, { key: "Delete" });
    expect(store.getState().board.connectors).toEqual([]);
  });

  it("矢印付きの線を引ける", () => {
    renderApp();
    addTwoStickies();
    fireEvent.change(screen.getByLabelText("矢印"), {
      target: { value: "both" },
    });
    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    clickItem(0);
    clickItem(1);
    expect(store.getState().board.connectors[0]).toMatchObject({
      startCap: "arrow",
      endCap: "arrow",
    });
  });

  it("メニューから矢印を切り替えられる", () => {
    renderApp();
    addTwoStickies();
    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    clickItem(0);
    clickItem(1);

    const [first, second] = store.getState().board.items;
    fireEvent.contextMenu(screen.getByTestId("board-canvas"), {
      clientX: ((first?.x ?? 0) + (first?.width ?? 0) + (second?.x ?? 0)) / 2,
      clientY: (first?.y ?? 0) + (first?.height ?? 0) / 2,
    });
    fireEvent.click(
      screen.getByRole("menuitem", { name: "終点の矢印を切り替え" }),
    );
    expect(store.getState().board.connectors[0]?.endCap).toBe("arrow");
  });

  it("メニューから始点の矢印も切り替えられる", () => {
    renderApp();
    addTwoStickies();
    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    clickItem(0);
    clickItem(1);

    const [first, second] = store.getState().board.items;
    fireEvent.contextMenu(screen.getByTestId("board-canvas"), {
      clientX: ((first?.x ?? 0) + (first?.width ?? 0) + (second?.x ?? 0)) / 2,
      clientY: (first?.y ?? 0) + (first?.height ?? 0) / 2,
    });
    fireEvent.click(
      screen.getByRole("menuitem", { name: "始点の矢印を切り替え" }),
    );
    expect(store.getState().board.connectors[0]).toMatchObject({
      startCap: "arrow",
      endCap: "none",
    });
  });

  it("線を右クリックすると削除メニューが出る", () => {
    renderApp();
    addTwoStickies();
    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    clickItem(0);
    clickItem(1);

    const [first, second] = store.getState().board.items;
    // 2 枚の付箋の間、線の高さ
    fireEvent.contextMenu(screen.getByTestId("board-canvas"), {
      clientX: ((first?.x ?? 0) + (first?.width ?? 0) + (second?.x ?? 0)) / 2,
      clientY: (first?.y ?? 0) + (first?.height ?? 0) / 2,
    });
    expect(screen.getByRole("menuitem", { name: "線を削除" })).toBeInTheDocument();
  });

  it("メニューから線を削除できる", () => {
    renderApp();
    addTwoStickies();
    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    clickItem(0);
    clickItem(1);

    const [first, second] = store.getState().board.items;
    fireEvent.contextMenu(screen.getByTestId("board-canvas"), {
      clientX: ((first?.x ?? 0) + (first?.width ?? 0) + (second?.x ?? 0)) / 2,
      clientY: (first?.y ?? 0) + (first?.height ?? 0) / 2,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "線を削除" }));
    expect(store.getState().board.connectors).toEqual([]);
  });
});

describe("App: 元に戻す / やり直す", () => {
  it("最初はどちらのボタンも無効", () => {
    renderApp();
    expect(screen.getByRole("button", { name: "元に戻す" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "やり直す" })).toBeDisabled();
  });

  it("操作すると元に戻せるようになる", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    expect(screen.getByRole("button", { name: "元に戻す" })).toBeEnabled();
  });

  it("ボタンで元に戻せる", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(store.getState().board.items).toEqual([]);
  });

  it("ボタンでやり直せる", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    fireEvent.click(screen.getByRole("button", { name: "やり直す" }));
    expect(store.getState().board.items).toHaveLength(1);
  });

  it("⌘Z で元に戻す", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    fireEvent.keyDown(window, { key: "z", metaKey: true });
    expect(store.getState().board.items).toEqual([]);
  });

  it("⇧⌘Z でやり直す", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    fireEvent.keyDown(window, { key: "z", metaKey: true });
    fireEvent.keyDown(window, { key: "Z", metaKey: true, shiftKey: true });
    expect(store.getState().board.items).toHaveLength(1);
  });

  it("テキスト編集中の ⌘Z はボードを戻さない", () => {
    // 入力欄の中の取り消しは入力欄自身に任せる。ボード全体を戻すと、
    // 編集の途中でアイテムごと消えることがある。
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    const item = store.getState().board.items[0];
    fireEvent.dblClick(screen.getByTestId("board-canvas"), {
      clientX: (item?.x ?? 0) + (item?.width ?? 0) / 2,
      clientY: (item?.y ?? 0) + (item?.height ?? 0) / 2,
    });
    fireEvent.change(screen.getByLabelText("アイテムのテキスト"), {
      target: { value: "メモ" },
    });
    fireEvent.keyDown(screen.getByLabelText("アイテムのテキスト"), {
      key: "z",
      metaKey: true,
    });
    expect(store.getState().board.items[0]).toMatchObject({ text: "メモ" });
    expect(screen.getByLabelText("アイテムのテキスト")).toBeInTheDocument();
  });

  it("テキスト編集中の ⌘N は新規作成しない", () => {
    // 文字を打っている最中の誤爆で、書きかけのボードを失わせない
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    const item = store.getState().board.items[0];
    fireEvent.dblClick(screen.getByTestId("board-canvas"), {
      clientX: (item?.x ?? 0) + (item?.width ?? 0) / 2,
      clientY: (item?.y ?? 0) + (item?.height ?? 0) / 2,
    });
    const editor = screen.getByLabelText("アイテムのテキスト");
    fireEvent.change(editor, { target: { value: "メモ" } });
    fireEvent.keyDown(editor, { key: "n", metaKey: true });

    expect(store.getState().board.items).toHaveLength(1);
    expect(screen.getByLabelText("アイテムのテキスト")).toBeInTheDocument();
  });

  it("ドラッグ移動は 1 回の操作としてまとめて戻る", () => {
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
      clientY: (before?.y ?? 0) + 10,
    });
    fireEvent.pointerMove(window, {
      clientX: (before?.x ?? 0) + 70,
      clientY: (before?.y ?? 0) + 10,
    });
    fireEvent.pointerUp(window);

    expect(store.getState().board.items[0]?.x).toBe((before?.x ?? 0) + 60);
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(store.getState().board.items[0]?.x).toBe(before?.x);
    // アイテムの追加自体はまだ残っている
    expect(store.getState().board.items).toHaveLength(1);
  });

  it("リサイズも 1 回の操作としてまとめて戻る", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    const before = store.getState().board.items[0];
    const canvas = screen.getByTestId("board-canvas");
    const handleX = (before?.x ?? 0) + (before?.width ?? 0);
    const handleY = (before?.y ?? 0) + (before?.height ?? 0);

    fireEvent.pointerDown(canvas, { button: 0, clientX: handleX, clientY: handleY });
    fireEvent.pointerMove(window, { clientX: handleX + 30, clientY: handleY + 30 });
    fireEvent.pointerMove(window, { clientX: handleX + 60, clientY: handleY + 60 });
    fireEvent.pointerUp(window);

    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(store.getState().board.items[0]).toMatchObject({
      width: before?.width,
      height: before?.height,
    });
  });

  it("パンだけのドラッグは履歴に残さない", () => {
    renderApp();
    const canvas = screen.getByTestId("board-canvas");
    fireEvent.pointerDown(canvas, { button: 0, clientX: 5, clientY: 5 });
    fireEvent.pointerMove(window, { clientX: 60, clientY: 60 });
    fireEvent.pointerUp(window);
    expect(screen.getByRole("button", { name: "元に戻す" })).toBeDisabled();
  });

  it("アイテムを掴んだだけで動かさなければ履歴に残さない", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    fireEvent.click(screen.getByRole("button", { name: "やり直す" }));

    const item = store.getState().board.items[0];
    const canvas = screen.getByTestId("board-canvas");
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: (item?.x ?? 0) + 10,
      clientY: (item?.y ?? 0) + 10,
    });
    fireEvent.pointerUp(window);

    // 追加の 1 件だけが残っているので、1 回戻せば空になる
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(store.getState().board.items).toEqual([]);
  });
});

describe("App: 選択したまま接続モードに入る", () => {
  /** 離れた場所に付箋を 2 枚置き、id を返す。 */
  function addTwoApart() {
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    const first = store.getState().board.items[0];
    fireEvent.click(screen.getByRole("button", { name: "青の付箋を追加" }));
    act(() => {
      const second = store.getState().board.items[1];
      if (second !== undefined) {
        store.getState().replaceItem({
          ...second,
          x: (first?.x ?? 0) + 400,
          y: first?.y ?? 0,
        });
      }
    });
    return store.getState().board.items.map((item) => item.id);
  }

  function clickItem(index: number) {
    const item = store.getState().board.items[index];
    fireEvent.pointerDown(screen.getByTestId("board-canvas"), {
      button: 0,
      clientX: (item?.x ?? 0) + 10,
      clientY: (item?.y ?? 0) + 10,
    });
  }

  it("選択したまま接続を押すと、それが始点になる", () => {
    renderApp();
    const ids = addTwoApart();
    // 2 枚目が選択されている状態で接続モードに入る
    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    // 相手をクリックするだけで線が引ける
    clickItem(0);
    expect(store.getState().board.connectors).toMatchObject([
      { fromItemId: ids[1], toItemId: ids[0] },
    ]);
  });

  it("選択を解除してから押した場合は始点なしで始まる", () => {
    renderApp();
    const ids = addTwoApart();
    act(() => store.getState().clearSelection());
    fireEvent.click(screen.getByRole("button", { name: "接続" }));

    clickItem(0);
    expect(store.getState().board.connectors).toEqual([]);
    clickItem(1);
    expect(store.getState().board.connectors).toMatchObject([
      { fromItemId: ids[0], toItemId: ids[1] },
    ]);
  });

  it("複数選択のときは始点を決めない", () => {
    renderApp();
    const ids = addTwoApart();
    act(() => store.getState().selectMany(ids));
    fireEvent.click(screen.getByRole("button", { name: "接続" }));

    clickItem(0);
    expect(store.getState().board.connectors).toEqual([]);
  });

  it("接続モードを抜けると選択を解除する", () => {
    renderApp();
    addTwoApart();
    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    expect(store.getState().selectedIds.size).toBe(0);
  });
});

describe("App: 線の選択と編集", () => {
  /** 付箋 3 枚を横一列に置き、1〜2 を線でつなぐ。 */
  function setupConnected() {
    for (let i = 0; i < 3; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    }
    const first = store.getState().board.items[0];
    act(() => {
      store.getState().board.items.forEach((item, index) => {
        store.getState().replaceItem({
          ...item,
          x: (first?.x ?? 0) + 400 * index,
          y: first?.y ?? 0,
        });
      });
      store.getState().clearSelection();
    });

    const items = store.getState().board.items;
    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    for (const index of [0, 1]) {
      const item = items[index];
      fireEvent.pointerDown(screen.getByTestId("board-canvas"), {
        button: 0,
        clientX: (item?.x ?? 0) + 10,
        clientY: (item?.y ?? 0) + 10,
      });
    }
    // 線がつながると接続モードは自動で終わる
    return store.getState().board.items.map((item) => item.id);
  }

  /** 1 枚目と 2 枚目の間、線の高さをクリックする。 */
  function clickConnector() {
    const [first, second] = store.getState().board.items;
    fireEvent.pointerDown(screen.getByTestId("board-canvas"), {
      button: 0,
      clientX: ((first?.x ?? 0) + (first?.width ?? 0) + (second?.x ?? 0)) / 2,
      clientY: (first?.y ?? 0) + (first?.height ?? 0) / 2,
    });
  }

  it("線をクリックすると設定パネルが出る", () => {
    renderApp();
    setupConnected();
    clickConnector();
    expect(screen.getByRole("group", { name: "線の設定" })).toBeInTheDocument();
  });

  it("線を選ぶとアイテムの選択は外れる", () => {
    renderApp();
    setupConnected();
    clickConnector();
    expect(store.getState().selectedIds.size).toBe(0);
  });

  it("線の種類を変えられる", () => {
    renderApp();
    setupConnected();
    clickConnector();
    fireEvent.change(screen.getByLabelText("種類"), {
      target: { value: "curved" },
    });
    expect(store.getState().board.connectors[0]?.kind).toBe("curved");
  });

  it("後から端の印を変えられる", () => {
    renderApp();
    setupConnected();
    clickConnector();
    fireEvent.change(screen.getByLabelText("終点"), {
      target: { value: "circle" },
    });
    expect(store.getState().board.connectors[0]?.endCap).toBe("circle");
  });

  it("パネルから線を削除できる", () => {
    renderApp();
    setupConnected();
    clickConnector();
    fireEvent.click(screen.getByRole("button", { name: "線を削除" }));
    expect(store.getState().board.connectors).toEqual([]);
    expect(screen.queryByRole("group", { name: "線の設定" })).not.toBeInTheDocument();
  });

  it("Delete キーでも選択中の線を消せる", () => {
    renderApp();
    setupConnected();
    clickConnector();
    fireEvent.keyDown(window, { key: "Delete" });
    expect(store.getState().board.connectors).toEqual([]);
    // アイテムは消えない
    expect(store.getState().board.items).toHaveLength(3);
  });

  it("端点をドラッグして接続先を変えられる", () => {
    renderApp();
    const ids = setupConnected();
    clickConnector();

    const items = store.getState().board.items;
    const second = items[1];
    const third = items[2];
    const canvas = screen.getByTestId("board-canvas");
    // 終点は 2 枚目の左端
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: second?.x ?? 0,
      clientY: (second?.y ?? 0) + (second?.height ?? 0) / 2,
    });
    fireEvent.pointerMove(window, {
      clientX: (third?.x ?? 0) + 50,
      clientY: (third?.y ?? 0) + 50,
    });
    fireEvent.pointerUp(window);

    expect(store.getState().board.connectors[0]).toMatchObject({
      fromItemId: ids[0],
      toItemId: ids[2],
    });
  });

  it("付け替えは 1 回で取り消せる", () => {
    renderApp();
    const ids = setupConnected();
    clickConnector();

    const items = store.getState().board.items;
    const second = items[1];
    const third = items[2];
    const canvas = screen.getByTestId("board-canvas");
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: second?.x ?? 0,
      clientY: (second?.y ?? 0) + (second?.height ?? 0) / 2,
    });
    fireEvent.pointerMove(window, {
      clientX: (third?.x ?? 0) + 30,
      clientY: (third?.y ?? 0) + 30,
    });
    fireEvent.pointerMove(window, {
      clientX: (third?.x ?? 0) + 50,
      clientY: (third?.y ?? 0) + 50,
    });
    fireEvent.pointerUp(window);

    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(store.getState().board.connectors[0]).toMatchObject({
      toItemId: ids[1],
    });
  });
});
