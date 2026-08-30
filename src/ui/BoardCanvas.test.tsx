import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

/** BoardCanvas を描画し、ビューポート変更を記録する。 */
function renderCanvas(viewport: Viewport = createViewport()) {
  const onViewportChange = vi.fn();
  const view = render(
    <BoardCanvas viewport={viewport} onViewportChange={onViewportChange} />,
  );
  const canvas = screen.getByTestId("board-canvas") as HTMLCanvasElement;
  return { canvas, onViewportChange, view };
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
        viewport={createViewport()}
        onViewportChange={vi.fn()}
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
    const { canvas, onViewportChange } = renderCanvas({
      x: 0,
      y: 0,
      scale: 2.5,
    });
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
    const { canvas, onViewportChange } = renderCanvas({
      x: 0,
      y: 0,
      scale: MAX_SCALE,
    });
    fireEvent.wheel(canvas, { deltaY: -5000, ctrlKey: true });
    expect(lastViewport(onViewportChange).scale).toBe(MAX_SCALE);
  });

  it("下限を下回って縮小しない", () => {
    const { canvas, onViewportChange } = renderCanvas({
      x: 0,
      y: 0,
      scale: MIN_SCALE,
    });
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
