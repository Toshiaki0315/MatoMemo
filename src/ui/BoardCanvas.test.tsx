import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBoard, createImage, createStickyNote } from "../domain/board";
import { addItem, moveItems } from "../domain/boardOps";
import {
  createViewport,
  MAX_SCALE,
  MIN_SCALE,
  type Viewport,
} from "../domain/viewport";
import { CANVAS_THEME } from "../render/boardRenderer";
import { stubLayout, type LayoutStub } from "../test/mockLayout";
import { stubCanvasContext } from "../test/mockCanvas";
import { BoardCanvas } from "./BoardCanvas";

let layout: LayoutStub;
let canvasStub: ReturnType<typeof stubCanvasContext>;

beforeEach(() => {
  layout = stubLayout({ width: 800, height: 600 });
  canvasStub = stubCanvasContext();
});

afterEach(() => {
  canvasStub.restore();
  layout.restore();
});

/** 100x100 の付箋を 1 枚だけ持つボード。 */
function boardWithSticky() {
  return addItem(
    createBoard({ id: "b1" }),
    createStickyNote({ id: "s1", x: 0, y: 0, width: 100, height: 100 }),
  );
}

interface RenderOptions {
  readonly viewport?: Viewport;
  readonly board?: ReturnType<typeof boardWithSticky>;
  readonly selectedIds?: ReadonlySet<string>;
}

/** BoardCanvas を描画し、各コールバックの呼び出しを記録する。 */
function renderCanvas(options: RenderOptions = {}) {
  const handlers = {
    onViewportChange: vi.fn(),
    onSelect: vi.fn(),
    onMoveSelected: vi.fn(),
    onDeleteSelected: vi.fn(),
    onActivateItem: vi.fn(),
  };
  const view = render(
    <BoardCanvas
      board={options.board ?? createBoard({ id: "b1" })}
      viewport={options.viewport ?? createViewport()}
      selectedIds={options.selectedIds ?? new Set()}
      {...handlers}
    />,
  );
  const canvas = screen.getByTestId("board-canvas") as HTMLCanvasElement;
  return { canvas, view, ...handlers };
}

/** onViewportChange に最後に渡されたビューポート。 */
function lastViewport(mock: ReturnType<typeof vi.fn>): Viewport {
  return mock.mock.calls.at(-1)?.[0] as Viewport;
}

describe("BoardCanvas: 描画", () => {
  it("キャンバス要素を描画する", () => {
    const { canvas } = renderCanvas();
    expect(canvas.tagName).toBe("CANVAS");
  });

  it("マウント時に背景を描く", () => {
    renderCanvas();
    expect(canvasStub.mock.callsOf("fillRect").length).toBeGreaterThan(0);
  });

  it("要素サイズとデバイスピクセル比からバッキングストアを確保する", () => {
    const { canvas } = renderCanvas();
    expect(canvas.width).toBe(800 * window.devicePixelRatio);
    expect(canvas.height).toBe(600 * window.devicePixelRatio);
  });

  it("リサイズに追従してバッキングストアを取り直す", () => {
    const { canvas } = renderCanvas();
    act(() => layout.triggerResize({ width: 1024, height: 768 }));
    expect(canvas.width).toBe(1024 * window.devicePixelRatio);
  });

  it("画像キャッシュを描画に渡す", () => {
    const image = createImage({
      id: "img",
      x: 0,
      y: 0,
      source: "data:image/png;base64,AA",
      naturalWidth: 20,
      naturalHeight: 20,
    });
    const bitmap = {} as CanvasImageSource;
    render(
      <BoardCanvas
        board={addItem(createBoard({ id: "b1" }), image)}
        viewport={createViewport()}
        selectedIds={new Set()}
        onViewportChange={vi.fn()}
        onSelect={vi.fn()}
        onMoveSelected={vi.fn()}
        onDeleteSelected={vi.fn()}
        images={new Map([["img", bitmap]])}
      />,
    );
    // サイズ計測の前後で描画されるため呼び出し回数は問わず、渡された画像を確認する
    expect(canvasStub.mock.callsOf("drawImage")[0]?.args[0]).toBe(bitmap);
  });

  it("2D コンテキストが取得できなくても壊れない", () => {
    canvasStub.restore();
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null,
    ) as unknown as typeof original;
    expect(() => renderCanvas()).not.toThrow();
    HTMLCanvasElement.prototype.getContext = original;
  });

  it("テーマを指定できる", () => {
    render(
      <BoardCanvas
        board={createBoard({ id: "b1" })}
        viewport={createViewport()}
        selectedIds={new Set()}
        onViewportChange={vi.fn()}
        onSelect={vi.fn()}
        onMoveSelected={vi.fn()}
        onDeleteSelected={vi.fn()}
        theme={CANVAS_THEME.dark}
      />,
    );
    expect(canvasStub.mock.ctx.fillStyle).toBe(CANVAS_THEME.dark.background);
  });
});

describe("BoardCanvas: ホイールによるパン", () => {
  it("縦スクロールで上下にパンする", () => {
    const { canvas, onViewportChange } = renderCanvas();
    fireEvent.wheel(canvas, { deltaX: 0, deltaY: 100 });
    expect(lastViewport(onViewportChange)).toEqual({ x: 0, y: -100, scale: 1 });
  });

  it("横スクロールで左右にパンする", () => {
    const { canvas, onViewportChange } = renderCanvas();
    fireEvent.wheel(canvas, { deltaX: 40, deltaY: 0 });
    expect(lastViewport(onViewportChange)).toEqual({ x: -40, y: 0, scale: 1 });
  });

  it("倍率は変わらない", () => {
    const { canvas, onViewportChange } = renderCanvas({ viewport: { x: 0, y: 0, scale: 2.5 } });
    fireEvent.wheel(canvas, { deltaX: 10, deltaY: 10 });
    expect(lastViewport(onViewportChange).scale).toBe(2.5);
  });
});

describe("BoardCanvas: ホイールによるズーム", () => {
  it("Ctrl + ホイール（トラックパッドのピンチ）で拡大する", () => {
    const { canvas, onViewportChange } = renderCanvas();
    fireEvent.wheel(canvas, { deltaY: -100, ctrlKey: true });
    expect(lastViewport(onViewportChange).scale).toBeGreaterThan(1);
  });

  it("Ctrl + 下方向ホイールで縮小する", () => {
    const { canvas, onViewportChange } = renderCanvas();
    fireEvent.wheel(canvas, { deltaY: 100, ctrlKey: true });
    expect(lastViewport(onViewportChange).scale).toBeLessThan(1);
  });

  it("Command + ホイールでも拡大する", () => {
    const { canvas, onViewportChange } = renderCanvas();
    fireEvent.wheel(canvas, { deltaY: -100, metaKey: true });
    expect(lastViewport(onViewportChange).scale).toBeGreaterThan(1);
  });

  it("カーソル位置のワールド座標を固定する", () => {
    const { canvas, onViewportChange } = renderCanvas();
    fireEvent.wheel(canvas, {
      deltaY: -100,
      ctrlKey: true,
      clientX: 200,
      clientY: 150,
    });
    const after = lastViewport(onViewportChange);
    // カーソル下のワールド座標 (200, 150) が動いていないこと
    expect((200 - after.x) / after.scale).toBeCloseTo(200, 6);
    expect((150 - after.y) / after.scale).toBeCloseTo(150, 6);
  });

  it("上限を超えて拡大しない", () => {
    const { canvas, onViewportChange } = renderCanvas({ viewport: { x: 0, y: 0, scale: MAX_SCALE } });
    fireEvent.wheel(canvas, { deltaY: -5000, ctrlKey: true });
    expect(lastViewport(onViewportChange).scale).toBe(MAX_SCALE);
  });

  it("下限を下回って縮小しない", () => {
    const { canvas, onViewportChange } = renderCanvas({ viewport: { x: 0, y: 0, scale: MIN_SCALE } });
    fireEvent.wheel(canvas, { deltaY: 5000, ctrlKey: true });
    expect(lastViewport(onViewportChange).scale).toBe(MIN_SCALE);
  });
});

describe("BoardCanvas: ドラッグによるパン", () => {
  it("ドラッグした分だけパンする", () => {
    const { canvas, onViewportChange } = renderCanvas();
    fireEvent.pointerDown(canvas, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 130, clientY: 80 });
    expect(lastViewport(onViewportChange)).toEqual({ x: 30, y: -20, scale: 1 });
  });

  it("複数回の移動を累積する", () => {
    const { canvas, onViewportChange } = renderCanvas();
    fireEvent.pointerDown(canvas, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(window, { clientX: 10, clientY: 0 });
    fireEvent.pointerMove(window, { clientX: 25, clientY: 0 });
    // 2 回目は直前の位置からの差分 (15) が渡される
    expect(onViewportChange).toHaveBeenLastCalledWith({
      x: 15,
      y: 0,
      scale: 1,
    });
  });

  it("ポインタを離すとパンが終わる", () => {
    const { canvas, onViewportChange } = renderCanvas();
    fireEvent.pointerDown(canvas, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(window);
    onViewportChange.mockClear();
    fireEvent.pointerMove(window, { clientX: 50, clientY: 50 });
    expect(onViewportChange).not.toHaveBeenCalled();
  });

  it("主ボタン以外のドラッグではパンしない", () => {
    const { canvas, onViewportChange } = renderCanvas();
    fireEvent.pointerDown(canvas, { button: 2, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(window, { clientX: 50, clientY: 50 });
    expect(onViewportChange).not.toHaveBeenCalled();
  });

  it("押していないときの移動は無視する", () => {
    const { onViewportChange } = renderCanvas();
    fireEvent.pointerMove(window, { clientX: 50, clientY: 50 });
    expect(onViewportChange).not.toHaveBeenCalled();
  });

  it("押していないときのポインタ解放は無視する", () => {
    const { onViewportChange } = renderCanvas();
    expect(() => fireEvent.pointerUp(window)).not.toThrow();
    expect(onViewportChange).not.toHaveBeenCalled();
  });

  it("パン中はカーソルを grabbing にする", () => {
    const { canvas } = renderCanvas();
    expect(canvas.style.cursor).toBe("grab");
    fireEvent.pointerDown(canvas, { button: 0, clientX: 0, clientY: 0 });
    expect(canvas.style.cursor).toBe("grabbing");
    fireEvent.pointerUp(window);
    expect(canvas.style.cursor).toBe("grab");
  });
});

describe("BoardCanvas: 後始末", () => {
  it("アンマウント後はイベントに反応しない", () => {
    const { canvas, onViewportChange, view } = renderCanvas();
    fireEvent.pointerDown(canvas, { button: 0, clientX: 0, clientY: 0 });
    view.unmount();
    onViewportChange.mockClear();
    fireEvent.pointerMove(window, { clientX: 50, clientY: 50 });
    expect(onViewportChange).not.toHaveBeenCalled();
  });
});

describe("BoardCanvas: アイテムの選択", () => {
  it("アイテムを押すと選択される", () => {
    const { canvas, onSelect } = renderCanvas({ board: boardWithSticky() });
    fireEvent.pointerDown(canvas, { button: 0, clientX: 50, clientY: 50 });
    expect(onSelect).toHaveBeenCalledWith("s1", false);
  });

  it("空白部分を押すと選択が解除される", () => {
    const { canvas, onSelect } = renderCanvas({ board: boardWithSticky() });
    fireEvent.pointerDown(canvas, { button: 0, clientX: 500, clientY: 500 });
    expect(onSelect).toHaveBeenCalledWith(null, false);
  });

  it("Shift を押しながらだと追加選択になる", () => {
    const { canvas, onSelect } = renderCanvas({ board: boardWithSticky() });
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 50,
      clientY: 50,
      shiftKey: true,
    });
    expect(onSelect).toHaveBeenCalledWith("s1", true);
  });

  it("Command を押しながらでも追加選択になる", () => {
    const { canvas, onSelect } = renderCanvas({ board: boardWithSticky() });
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 50,
      clientY: 50,
      metaKey: true,
    });
    expect(onSelect).toHaveBeenCalledWith("s1", true);
  });

  it("Shift + 空白部分では選択を解除しない", () => {
    const { canvas, onSelect } = renderCanvas({ board: boardWithSticky() });
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 500,
      clientY: 500,
      shiftKey: true,
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("選択済みのアイテムを掴んでも選択を変えない（複数選択を保つ）", () => {
    const { canvas, onSelect } = renderCanvas({
      board: boardWithSticky(),
      selectedIds: new Set(["s1", "other"]),
    });
    fireEvent.pointerDown(canvas, { button: 0, clientX: 50, clientY: 50 });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("ビューポートを考慮して当たり判定する", () => {
    // 2 倍に拡大すると付箋は画面上 0〜200px を占める
    const { canvas, onSelect } = renderCanvas({
      board: boardWithSticky(),
      viewport: { x: 0, y: 0, scale: 2 },
    });
    fireEvent.pointerDown(canvas, { button: 0, clientX: 150, clientY: 150 });
    expect(onSelect).toHaveBeenCalledWith("s1", false);
  });
});

describe("BoardCanvas: アイテムのドラッグ移動", () => {
  it("アイテムを掴んでドラッグすると移動する", () => {
    const { canvas, onMoveSelected, onViewportChange } = renderCanvas({
      board: boardWithSticky(),
    });
    fireEvent.pointerDown(canvas, { button: 0, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(window, { clientX: 70, clientY: 40 });
    expect(onMoveSelected).toHaveBeenCalledWith(20, -10);
    // アイテムを動かしているのでビューポートは動かない
    expect(onViewportChange).not.toHaveBeenCalled();
  });

  it("拡大時は移動量をワールド座標に直す", () => {
    const { canvas, onMoveSelected } = renderCanvas({
      board: boardWithSticky(),
      viewport: { x: 0, y: 0, scale: 2 },
    });
    fireEvent.pointerDown(canvas, { button: 0, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(window, { clientX: 70, clientY: 50 });
    expect(onMoveSelected).toHaveBeenCalledWith(10, 0);
  });

  it("空白部分のドラッグはパンになる", () => {
    const { canvas, onMoveSelected, onViewportChange } = renderCanvas({
      board: boardWithSticky(),
    });
    fireEvent.pointerDown(canvas, { button: 0, clientX: 500, clientY: 500 });
    fireEvent.pointerMove(window, { clientX: 520, clientY: 500 });
    expect(onViewportChange).toHaveBeenCalled();
    expect(onMoveSelected).not.toHaveBeenCalled();
  });

  it("ポインタを離すと移動が終わる", () => {
    const { canvas, onMoveSelected } = renderCanvas({
      board: boardWithSticky(),
    });
    fireEvent.pointerDown(canvas, { button: 0, clientX: 50, clientY: 50 });
    fireEvent.pointerUp(window);
    fireEvent.pointerMove(window, { clientX: 200, clientY: 200 });
    expect(onMoveSelected).not.toHaveBeenCalled();
  });
});

describe("BoardCanvas: 削除", () => {
  it("Delete キーで選択中のアイテムを削除する", () => {
    const { onDeleteSelected } = renderCanvas({ board: boardWithSticky() });
    fireEvent.keyDown(window, { key: "Delete" });
    expect(onDeleteSelected).toHaveBeenCalled();
  });

  it("Backspace キーでも削除する", () => {
    const { onDeleteSelected } = renderCanvas({ board: boardWithSticky() });
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(onDeleteSelected).toHaveBeenCalled();
  });

  it("他のキーでは削除しない", () => {
    const { onDeleteSelected } = renderCanvas({ board: boardWithSticky() });
    fireEvent.keyDown(window, { key: "a" });
    expect(onDeleteSelected).not.toHaveBeenCalled();
  });

  it("テキスト入力中は削除しない", () => {
    const { onDeleteSelected } = renderCanvas({ board: boardWithSticky() });
    const input = document.createElement("textarea");
    document.body.append(input);
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(onDeleteSelected).not.toHaveBeenCalled();
    input.remove();
  });

  it("入力欄以外の要素からのキー操作では削除する", () => {
    const { onDeleteSelected } = renderCanvas({ board: boardWithSticky() });
    const div = document.createElement("div");
    document.body.append(div);
    fireEvent.keyDown(div, { key: "Delete" });
    expect(onDeleteSelected).toHaveBeenCalled();
    div.remove();
  });

  it("要素以外がイベントの対象でも壊れない", () => {
    const { onDeleteSelected } = renderCanvas({ board: boardWithSticky() });
    fireEvent.keyDown(document, { key: "Delete" });
    expect(onDeleteSelected).toHaveBeenCalled();
  });
});

describe("BoardCanvas: ダブルクリック", () => {
  it("アイテムのダブルクリックで onActivateItem を呼ぶ", () => {
    const { canvas, onActivateItem } = renderCanvas({
      board: boardWithSticky(),
    });
    fireEvent.dblClick(canvas, { clientX: 50, clientY: 50 });
    expect(onActivateItem).toHaveBeenCalledWith("s1");
  });

  it("空白部分のダブルクリックでは呼ばない", () => {
    const { canvas, onActivateItem } = renderCanvas({
      board: boardWithSticky(),
    });
    fireEvent.dblClick(canvas, { clientX: 500, clientY: 500 });
    expect(onActivateItem).not.toHaveBeenCalled();
  });

  it("onActivateItem が未指定でも壊れない", () => {
    render(
      <BoardCanvas
        board={boardWithSticky()}
        viewport={createViewport()}
        selectedIds={new Set()}
        onViewportChange={vi.fn()}
        onSelect={vi.fn()}
        onMoveSelected={vi.fn()}
        onDeleteSelected={vi.fn()}
      />,
    );
    const canvas = screen.getAllByTestId("board-canvas")[0] as HTMLCanvasElement;
    expect(() =>
      fireEvent.dblClick(canvas, { clientX: 50, clientY: 50 }),
    ).not.toThrow();
  });
});

describe("BoardCanvas: 再レンダリングを挟むドラッグ", () => {
  it("連続したドラッグの移動量が累積する", () => {
    const board = boardWithSticky();
    let latestX = 0;
    function Harness() {
      const [state, setState] = useState({
        board,
        viewport: createViewport(),
        selectedIds: new Set<string>(),
      });
      latestX = state.board.items[0]?.x ?? 0;
      return (
        <BoardCanvas
          board={state.board}
          viewport={state.viewport}
          selectedIds={state.selectedIds}
          onViewportChange={(viewport) =>
            setState((prev) => ({ ...prev, viewport }))
          }
          onSelect={(id) =>
            setState((prev) => ({
              ...prev,
              selectedIds: new Set(id === null ? [] : [id]),
            }))
          }
          onMoveSelected={(dx, dy) =>
            setState((prev) => ({
              ...prev,
              board: moveItems(prev.board, [...prev.selectedIds], dx, dy),
            }))
          }
          onDeleteSelected={() => {}}
        />
      );
    }
    render(<Harness />);
    const canvas = screen.getByTestId("board-canvas");

    fireEvent.pointerDown(canvas, { button: 0, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(window, { clientX: 70, clientY: 50 });
    fireEvent.pointerMove(window, { clientX: 90, clientY: 50 });
    fireEvent.pointerMove(window, { clientX: 110, clientY: 50 });

    // 合計 60 だけ動いているはず
    expect(latestX).toBe(60);
  });

  it("パンも再レンダリングを挟んで継続する", () => {
    let latestX = 0;
    function Harness() {
      const [viewport, setViewport] = useState(createViewport());
      latestX = viewport.x;
      return (
        <BoardCanvas
          board={createBoard({ id: "b1" })}
          viewport={viewport}
          selectedIds={new Set()}
          onViewportChange={setViewport}
          onSelect={vi.fn()}
          onMoveSelected={vi.fn()}
          onDeleteSelected={vi.fn()}
        />
      );
    }
    render(<Harness />);
    const canvas = screen.getByTestId("board-canvas");

    fireEvent.pointerDown(canvas, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(window, { clientX: 20, clientY: 0 });
    fireEvent.pointerMove(window, { clientX: 40, clientY: 0 });

    expect(latestX).toBe(40);
  });
});

describe("BoardCanvas: 編集中のアイテム", () => {
  it("編集中のアイテムのテキストは Canvas に描かない", () => {
    const board = addItem(
      createBoard({ id: "b1" }),
      createStickyNote({ id: "s1", x: 0, y: 0, text: "メモ" }),
    );
    render(
      <BoardCanvas
        board={board}
        viewport={createViewport()}
        selectedIds={new Set()}
        onViewportChange={vi.fn()}
        onSelect={vi.fn()}
        onMoveSelected={vi.fn()}
        onDeleteSelected={vi.fn()}
        editingItemId="s1"
      />,
    );
    expect(canvasStub.mock.callsOf("fillText")).toHaveLength(0);
  });
});
