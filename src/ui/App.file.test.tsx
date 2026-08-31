/**
 * 保存・読み込みまわりの統合テスト。
 *
 * ドメイン層からファイル入出力まで一貫して通し、UI の操作だけで
 * ボードを作り、保存し、読み戻せることを確かめる。
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorageError } from "../platform/boardFileStore";
import {
  createMemoryBoardFileStore,
  type MemoryBoardFileStore,
} from "../platform/memoryBoardFileStore";
import { createBoardStore, type BoardStore } from "../store/boardStore";
import { stubCanvasContext } from "../test/mockCanvas";
import { stubLayout, type LayoutStub } from "../test/mockLayout";
import { App, AUTOSAVE_INTERVAL_MS } from "./App";

let layout: LayoutStub;
let canvasStub: ReturnType<typeof stubCanvasContext>;
let store: BoardStore;
let fileStore: MemoryBoardFileStore;
/** 閉じる要求を発火させる関数。null なら購読されていない。 */
let requestClose: (() => Promise<boolean>) | null;
let closeWindow: ReturnType<typeof vi.fn>;

beforeEach(() => {
  layout = stubLayout({ width: 800, height: 600 });
  canvasStub = stubCanvasContext();
  let counter = 0;
  store = createBoardStore({ createId: () => `id-${(counter += 1)}` });
  fileStore = createMemoryBoardFileStore();
  requestClose = null;
  closeWindow = vi.fn();
});

afterEach(() => {
  canvasStub.restore();
  layout.restore();
});

function renderApp() {
  return render(
    <App
      store={store}
      fileStore={fileStore}
      closeGuard={async (onRequest) => {
        requestClose = async () => onRequest();
        return () => {
          requestClose = null;
        };
      }}
      closeWindow={closeWindow}
    />,
  );
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
  // 線がつながると接続モードは自動で終わる
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

  it("保存を待つ間に加えた変更は保存済みにならない", async () => {
    fileStore.savePath = "/tmp/board.matomemo";
    // 書き込みの完了をテスト側から制御できるようにする
    let release = () => {};
    const originalSave = fileStore.save.bind(fileStore);
    fileStore.save = (path, board) =>
      new Promise((resolve) => {
        release = () => resolve(originalSave(path, board));
      });
    renderApp();
    click("黄色の付箋を追加");
    click("保存");

    // 書き込みが終わる前にさらに編集する
    click("黄色の付箋を追加");
    act(() => release());

    await waitFor(() => {
      expect(fileStore.files.has("/tmp/board.matomemo")).toBe(true);
    });
    // 保存されたのは 1 枚目まで。2 枚目はまだディスクに無いので未保存のまま
    expect(screen.getByRole("status")).toHaveAccessibleName(
      "未保存の変更があります",
    );
  });

  it("保存の実行中は ⌘S を重ねて受け付けない", async () => {
    fileStore.savePath = "/tmp/board.matomemo";
    let release = () => {};
    let saveCalls = 0;
    const originalSave = fileStore.save.bind(fileStore);
    fileStore.save = (path, board) => {
      saveCalls += 1;
      return new Promise((resolve) => {
        release = () => resolve(originalSave(path, board));
      });
    };
    renderApp();
    click("黄色の付箋を追加");
    fireEvent.keyDown(window, { key: "s", metaKey: true });
    fireEvent.keyDown(window, { key: "s", metaKey: true });
    act(() => release());

    await waitFor(() => {
      expect(fileStore.files.has("/tmp/board.matomemo")).toBe(true);
    });
    expect(saveCalls).toBe(1);
  });

  it("保存を待つ間に新規にしても、保存先と保存済み状態を引き継がない", async () => {
    fileStore.savePath = "/tmp/board.matomemo";
    let release = () => {};
    const originalSave = fileStore.save.bind(fileStore);
    fileStore.save = (path, board) =>
      new Promise((resolve) => {
        release = () => resolve(originalSave(path, board));
      });
    renderApp();
    click("黄色の付箋を追加");

    // 確認ダイアログを出し、保存を始めてから「破棄して続行」で新規にする
    click("新規");
    fireEvent.keyDown(window, { key: "s", metaKey: true });
    click("破棄して続行");
    act(() => release());

    await waitFor(() => {
      expect(fileStore.files.has("/tmp/board.matomemo")).toBe(true);
    });
    // 新しい空のボードに、切り替え前の保存先や保存済み状態が付いてはいけない。
    // 付くと、次の保存が以前のファイルを黙って上書きしてしまう。
    expect(store.getState().board.items).toEqual([]);
    expect(store.getState().filePath).toBeNull();
    expect(store.getState().isDirty()).toBe(false);
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
    act(() => store.getState().markSaved("/tmp/x.matomemo", store.getState().board));

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
    act(() => store.getState().markSaved("/tmp/x.matomemo", store.getState().board));
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

describe("ウィンドウを閉じるときの確認", () => {
  /** 閉じる要求が購読されるのを待つ。 */
  async function waitForGuard() {
    await waitFor(() => expect(requestClose).not.toBeNull());
  }

  /**
   * 閉じる要求を発火させ、閉じてよいかの判定を返す。
   * 確認ダイアログの表示は React の状態更新なので act で囲む。
   */
  async function fireCloseRequest(): Promise<boolean | undefined> {
    let result: boolean | undefined;
    await act(async () => {
      result = await requestClose?.();
    });
    return result;
  }

  it("未保存でなければそのまま閉じる", async () => {
    renderApp();
    await waitForGuard();
    expect(await fireCloseRequest()).toBe(true);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("未保存なら閉じるのを止めて確認する", async () => {
    renderApp();
    await waitForGuard();
    click("黄色の付箋を追加");

    expect(await fireCloseRequest()).toBe(false);
    expect(screen.getByRole("alertdialog")).toHaveTextContent("終了");
  });

  it("確認して終了を選ぶとウィンドウを閉じる", async () => {
    renderApp();
    await waitForGuard();
    click("黄色の付箋を追加");
    await fireCloseRequest();

    click("保存せずに終了");
    await waitFor(() => expect(closeWindow).toHaveBeenCalled());
  });

  it("キャンセルすると閉じない", async () => {
    renderApp();
    await waitForGuard();
    click("黄色の付箋を追加");
    await fireCloseRequest();

    click("キャンセル");
    expect(closeWindow).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("保存してからならそのまま閉じられる", async () => {
    fileStore.savePath = "/tmp/board.matomemo";
    renderApp();
    await waitForGuard();
    click("黄色の付箋を追加");
    click("保存");
    await waitFor(() => expect(fileStore.files.size).toBe(1));

    expect(await fireCloseRequest()).toBe(true);
  });

  it("アンマウントすると購読を解除する", async () => {
    const view = renderApp();
    await waitForGuard();
    view.unmount();
    expect(requestClose).toBeNull();
  });

  it("購読の完了前にアンマウントされても解除する", async () => {
    let resolveGuard: ((unlisten: () => void) => void) | undefined;
    const unlisten = vi.fn();
    const view = render(
      <App
        store={store}
        fileStore={fileStore}
        closeGuard={() =>
          new Promise((resolve) => {
            resolveGuard = resolve;
          })
        }
        closeWindow={closeWindow}
      />,
    );
    view.unmount();
    resolveGuard?.(unlisten);
    await waitFor(() => expect(unlisten).toHaveBeenCalled());
  });
});

describe("Tauri の外で動かした場合", () => {
  it("閉じる要求を購読できなくても編集は続けられる", async () => {
    render(
      <App
        store={store}
        fileStore={fileStore}
        closeGuard={async () => {
          throw new Error("Tauri がありません");
        }}
        closeWindow={closeWindow}
      />,
    );

    // 購読の失敗は握りつぶし、アプリは通常どおり使える
    click("黄色の付箋を追加");
    await waitFor(() => {
      expect(store.getState().board.items).toHaveLength(1);
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Markdown 出力", () => {
  /** 3 枚の付箋を A → B → C とつないだボードを作る。 */
  function buildChain() {
    for (const text of ["課題", "原因", "対策"]) {
      click("黄色の付箋を追加");
      act(() => {
        const items = store.getState().board.items;
        const added = items.at(-1);
        const first = items[0];
        if (added !== undefined && added.type === "sticky") {
          store.getState().replaceItem({
            ...added,
            text,
            x: (first?.x ?? 0) + 400 * (items.length - 1),
            y: first?.y ?? 0,
          });
        }
        store.getState().clearSelection();
      });
    }

    const items = store.getState().board.items;
    // 線がつながるたびに接続モードは自動で終わるので、1 本ごとに入り直す
    for (const [from, to] of [
      [0, 1],
      [1, 2],
    ] as const) {
      click("接続");
      for (const index of [from, to]) {
        const item = items[index];
        fireEvent.pointerDown(screen.getByTestId("board-canvas"), {
          button: 0,
          clientX: (item?.x ?? 0) + 10,
          clientY: (item?.y ?? 0) + 10,
        });
      }
    }
  }

  it("線のつながりを入れ子の箇条書きにする", async () => {
    fileStore.exportPath = "/tmp/board.md";
    renderApp();
    fireEvent.change(screen.getByLabelText("ボード名"), {
      target: { value: "検討メモ" },
    });
    buildChain();

    click("Markdown 出力");
    await waitFor(() => {
      expect(fileStore.files.has("/tmp/board.md")).toBe(true);
    });
    expect(fileStore.files.get("/tmp/board.md")).toBe(
      "# 検討メモ\n\n- 課題\n  - 原因\n    - 対策\n",
    );
  });

  it("キャンセルすると何も書き出さない", async () => {
    fileStore.exportPath = null;
    renderApp();
    buildChain();

    click("Markdown 出力");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Markdown 出力" }),
      ).toBeEnabled();
    });
    expect(fileStore.files.size).toBe(0);
  });

  it("書き出しに失敗するとメッセージを出す", async () => {
    fileStore.exportText = async () => {
      throw new StorageError("書き出せませんでした。");
    };
    renderApp();
    buildChain();

    click("Markdown 出力");
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "書き出せませんでした。",
      );
    });
  });

  it("Markdown を書き出してもボードは未保存のままにする", async () => {
    fileStore.exportPath = "/tmp/board.md";
    renderApp();
    buildChain();

    click("Markdown 出力");
    await waitFor(() => expect(fileStore.files.size).toBe(1));
    expect(store.getState().isDirty()).toBe(true);
  });
});

describe("自動保存", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** 自動保存のタイマーを 1 回分進め、保存の完了まで待つ。 */
  async function advanceAutosave() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS);
    });
  }

  /** 付箋を置いて保存済みにし、保存先を持ったボードを作る。 */
  function setupSavedBoard() {
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    act(() =>
      store
        .getState()
        .markSaved("/tmp/auto.matomemo", store.getState().board),
    );
  }

  it("保存先が決まっていれば一定時間ごとに自動保存する", async () => {
    vi.useFakeTimers();
    renderApp();
    setupSavedBoard();
    // 保存後にさらに編集して未保存の変更を作る
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));
    expect(store.getState().isDirty()).toBe(true);

    await advanceAutosave();

    expect(fileStore.files.has("/tmp/auto.matomemo")).toBe(true);
    expect(store.getState().isDirty()).toBe(false);
  });

  it("保存先が決まっていなければ自動保存しない（ダイアログも出さない）", async () => {
    vi.useFakeTimers();
    fileStore.savePath = "/tmp/never.matomemo";
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));

    await advanceAutosave();

    expect(fileStore.files.size).toBe(0);
    expect(store.getState().isDirty()).toBe(true);
  });

  it("変更が無ければ書き込まない", async () => {
    vi.useFakeTimers();
    renderApp();
    setupSavedBoard();
    const saveSpy = vi.spyOn(fileStore, "save");

    await advanceAutosave();

    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("自動保存の失敗はメッセージで知らせる", async () => {
    vi.useFakeTimers();
    fileStore.save = async () => {
      throw new StorageError("保存できませんでした。");
    };
    renderApp();
    setupSavedBoard();
    fireEvent.click(screen.getByRole("button", { name: "黄色の付箋を追加" }));

    await advanceAutosave();

    expect(screen.getByRole("alert")).toHaveTextContent("保存できませんでした。");
    expect(store.getState().isDirty()).toBe(true);
  });
});
