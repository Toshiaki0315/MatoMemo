/**
 * 保存・読み込みまわりの統合テスト。
 *
 * ドメイン層からファイル入出力まで一貫して通し、UI の操作だけで
 * ボードを作り、保存し、読み戻せることを確かめる。
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StorageError } from "../platform/boardFileStore";
import {
  createMemoryBoardFileStore,
  type MemoryBoardFileStore,
} from "../platform/memoryBoardFileStore";
import { createBoardStore, type BoardStore } from "../store/boardStore";
import { stubCanvasContext } from "../test/mockCanvas";
import { stubLayout, type LayoutStub } from "../test/mockLayout";
import { App } from "./App";

let layout: LayoutStub;
let canvasStub: ReturnType<typeof stubCanvasContext>;
let store: BoardStore;
let fileStore: MemoryBoardFileStore;

beforeEach(() => {
  layout = stubLayout({ width: 800, height: 600 });
  canvasStub = stubCanvasContext();
  let counter = 0;
  store = createBoardStore({ createId: () => `id-${(counter += 1)}` });
  fileStore = createMemoryBoardFileStore();
});

afterEach(() => {
  canvasStub.restore();
  layout.restore();
});

function renderApp() {
  return render(<App store={store} fileStore={fileStore} />);
}

function click(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

/** 付箋・図形・テキストを 1 つずつ置き、線でつないだボードを作る。 */
function buildBoard() {
  click("黄色の付箋を追加");
  click("円");
  click("テキスト");

  // 2 つ目と 3 つ目を離して重ならないようにする
  act(() => {
    const items = store.getState().board.items;
    const first = items[0];
    items.slice(1).forEach((item, index) => {
      store.getState().replaceItem({
        ...item,
        x: (first?.x ?? 0) + 400 * (index + 1),
        y: first?.y ?? 0,
      });
    });
  });

  click("接続");
  const items = store.getState().board.items;
  for (const index of [0, 1]) {
    const item = items[index];
    // 円は外接矩形の角では当たらないため、中心を狙う。
    // 十分に離して配置しているので他のアイテムとは重ならない。
    fireEvent.pointerDown(screen.getByTestId("board-canvas"), {
      button: 0,
      clientX: (item?.x ?? 0) + (item?.width ?? 0) / 2,
      clientY: (item?.y ?? 0) + (item?.height ?? 0) / 2,
    });
  }
  click("接続");
}

describe("保存", () => {
  it("保存先が未定なら保存ダイアログを使う", async () => {
    fileStore.savePath = "/tmp/board.matomemo";
    renderApp();
    buildBoard();
    click("保存");

    await waitFor(() => {
      expect(fileStore.files.has("/tmp/board.matomemo")).toBe(true);
    });
  });

  it("保存すると未保存の印が消える", async () => {
    fileStore.savePath = "/tmp/board.matomemo";
    renderApp();
    buildBoard();
    expect(screen.getByRole("status")).toHaveAccessibleName(
      "未保存の変更があります",
    );

    click("保存");
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveAccessibleName("保存済み");
    });
  });

  it("2 回目の保存はダイアログを出さず同じファイルに書く", async () => {
    fileStore.savePath = "/tmp/board.matomemo";
    renderApp();
    buildBoard();
    click("保存");
    await waitFor(() => expect(fileStore.files.size).toBe(1));

    // 保存先の候補を変えても、既に決まったパスに書かれる
    fileStore.savePath = "/tmp/other.matomemo";
    click("黄色の付箋を追加");
    click("保存");

    await waitFor(() => {
      expect(store.getState().isDirty()).toBe(false);
    });
    expect(fileStore.files.has("/tmp/other.matomemo")).toBe(false);
  });

  it("別名で保存はいつでもダイアログを使う", async () => {
    fileStore.savePath = "/tmp/first.matomemo";
    renderApp();
    buildBoard();
    click("保存");
    await waitFor(() => expect(fileStore.files.size).toBe(1));

    fileStore.savePath = "/tmp/second.matomemo";
    click("別名で保存");
    await waitFor(() => {
      expect(fileStore.files.has("/tmp/second.matomemo")).toBe(true);
    });
  });

  it("保存をキャンセルすると未保存のままになる", async () => {
    fileStore.savePath = null;
    renderApp();
    buildBoard();
    click("保存");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
    });
    expect(fileStore.files.size).toBe(0);
    expect(store.getState().isDirty()).toBe(true);
  });

  it("Error 以外が投げられても既定のメッセージを出す", async () => {
    fileStore.savePath = "/tmp/board.matomemo";
    fileStore.save = async () => {
      throw "想定外";
    };
    renderApp();
    buildBoard();
    click("保存");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("操作に失敗しました。");
    });
  });

  it("保存に失敗するとメッセージを出す", async () => {
    fileStore.savePath = "/tmp/board.matomemo";
    fileStore.save = async () => {
      throw new StorageError("ディスクに空きがありません。");
    };
    renderApp();
    buildBoard();
    click("保存");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "ディスクに空きがありません。",
      );
    });
  });
});

describe("読み込み", () => {
  /** ボードを作って保存し、その内容を返す。 */
  async function saveBoard(path = "/tmp/board.matomemo") {
    fileStore.savePath = path;
    buildBoard();
    click("保存");
    await waitFor(() => expect(fileStore.files.has(path)).toBe(true));
    return store.getState().board;
  }

  it("保存したボードを完全に復元する", async () => {
    renderApp();
    const saved = await saveBoard();

    // 別のボードにしてから読み戻す
    act(() => store.getState().newBoard());
    fileStore.openPath = "/tmp/board.matomemo";
    click("開く");

    await waitFor(() => {
      expect(store.getState().board).toEqual(saved);
    });
  });

  it("アイテムの重なり順も保たれる", async () => {
    renderApp();
    const saved = await saveBoard();
    act(() => store.getState().newBoard());
    fileStore.openPath = "/tmp/board.matomemo";
    click("開く");

    await waitFor(() => {
      expect(store.getState().board.items.map((item) => item.id)).toEqual(
        saved.items.map((item) => item.id),
      );
    });
  });

  it("コネクタも復元する", async () => {
    renderApp();
    const saved = await saveBoard();
    act(() => store.getState().newBoard());
    fileStore.openPath = "/tmp/board.matomemo";
    click("開く");

    await waitFor(() => {
      expect(store.getState().board.connectors).toEqual(saved.connectors);
    });
    expect(saved.connectors.length).toBeGreaterThan(0);
  });

  it("読み込み直後は未保存でない", async () => {
    renderApp();
    await saveBoard();
    act(() => store.getState().newBoard());
    fileStore.openPath = "/tmp/board.matomemo";
    click("開く");

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveAccessibleName("保存済み");
    });
  });

  it("読み込みをキャンセルすると何も変わらない", async () => {
    renderApp();
    click("黄色の付箋を追加");
    const before = store.getState().board;
    act(() => store.getState().markSaved("/tmp/x.matomemo"));

    fileStore.openPath = null;
    click("開く");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "開く" })).toBeEnabled();
    });
    expect(store.getState().board).toBe(before);
  });

  it("壊れたファイルはメッセージを出す", async () => {
    renderApp();
    fileStore.files.set("/tmp/broken.matomemo", "これは JSON ではない");
    fileStore.openPath = "/tmp/broken.matomemo";
    click("開く");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/JSON/);
    });
  });

  it("読み込みに失敗してもボードは壊れない", async () => {
    renderApp();
    click("黄色の付箋を追加");
    // 未保存だと確認ダイアログが挟まるので、保存済みの状態にしておく
    act(() => store.getState().markSaved("/tmp/x.matomemo"));
    const before = store.getState().board;
    fileStore.openPath = "/tmp/missing.matomemo";
    click("開く");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(store.getState().board).toBe(before);
  });
});

describe("未保存の変更の確認", () => {
  it("未保存で新規にしようとすると確認する", () => {
    renderApp();
    click("黄色の付箋を追加");
    click("新規");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(store.getState().board.items).toHaveLength(1);
  });

  it("破棄を選ぶと実行される", () => {
    renderApp();
    click("黄色の付箋を追加");
    click("新規");
    click("破棄して続行");
    expect(store.getState().board.items).toEqual([]);
  });

  it("キャンセルすると何も起きない", () => {
    renderApp();
    click("黄色の付箋を追加");
    click("新規");
    click("キャンセル");
    expect(store.getState().board.items).toHaveLength(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("未保存でなければ確認せずに実行する", () => {
    renderApp();
    click("新規");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("未保存で開こうとするときも確認する", async () => {
    renderApp();
    click("黄色の付箋を追加");
    fileStore.openPath = null;
    click("開く");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    click("破棄して続行");
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });
});

describe("ボード名", () => {
  it("名前を変えられる", () => {
    renderApp();
    fireEvent.change(screen.getByLabelText("ボード名"), {
      target: { value: "設計メモ" },
    });
    expect(store.getState().board.name).toBe("設計メモ");
  });

  it("名前も保存され復元される", async () => {
    renderApp();
    fireEvent.change(screen.getByLabelText("ボード名"), {
      target: { value: "設計メモ" },
    });
    fileStore.savePath = "/tmp/board.matomemo";
    click("保存");
    await waitFor(() => expect(fileStore.files.size).toBe(1));

    act(() => store.getState().newBoard());
    fileStore.openPath = "/tmp/board.matomemo";
    click("開く");
    await waitFor(() => {
      expect(screen.getByLabelText("ボード名")).toHaveValue("設計メモ");
    });
  });
});

describe("キーボード操作", () => {
  it("Command + S で保存する", async () => {
    fileStore.savePath = "/tmp/board.matomemo";
    renderApp();
    click("黄色の付箋を追加");
    fireEvent.keyDown(window, { key: "s", metaKey: true });

    await waitFor(() => {
      expect(fileStore.files.has("/tmp/board.matomemo")).toBe(true);
    });
  });

  it("Command + Shift + S で別名保存する", async () => {
    fileStore.savePath = "/tmp/first.matomemo";
    renderApp();
    click("黄色の付箋を追加");
    fireEvent.keyDown(window, { key: "s", metaKey: true });
    await waitFor(() => expect(fileStore.files.size).toBe(1));

    fileStore.savePath = "/tmp/second.matomemo";
    fireEvent.keyDown(window, { key: "S", metaKey: true, shiftKey: true });
    await waitFor(() => {
      expect(fileStore.files.has("/tmp/second.matomemo")).toBe(true);
    });
  });

  it("Command + O で開く", async () => {
    renderApp();
    fileStore.openPath = null;
    fireEvent.keyDown(window, { key: "o", metaKey: true });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "開く" })).toBeEnabled();
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("Command + N で新規にする", () => {
    renderApp();
    fireEvent.keyDown(window, { key: "n", metaKey: true });
    expect(store.getState().board.items).toEqual([]);
  });

  it("Command なしのキーでは反応しない", () => {
    renderApp();
    click("黄色の付箋を追加");
    fireEvent.keyDown(window, { key: "n" });
    expect(store.getState().board.items).toHaveLength(1);
  });

  it("Control や Option と一緒では反応しない", () => {
    renderApp();
    click("黄色の付箋を追加");
    fireEvent.keyDown(window, { key: "n", metaKey: true, ctrlKey: true });
    fireEvent.keyDown(window, { key: "n", metaKey: true, altKey: true });
    expect(store.getState().board.items).toHaveLength(1);
  });

  it("割り当てのないキーでは何も起きない", () => {
    renderApp();
    click("黄色の付箋を追加");
    fireEvent.keyDown(window, { key: "p", metaKey: true });
    expect(store.getState().board.items).toHaveLength(1);
  });
});
