import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAX_SCALE, MIN_SCALE } from "../domain/viewport";
import { stubCanvasContext } from "../test/mockCanvas";
import { stubLayout, type LayoutStub } from "../test/mockLayout";
import { App } from "./App";

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

/** 倍率表示（リセットボタン）のラベル。 */
function zoomLabel(): string {
  return screen.getByRole("button", { name: "表示倍率をリセット" })
    .textContent as string;
}

describe("App", () => {
  it("キャンバスを表示する", () => {
    render(<App />);
    expect(screen.getByTestId("board-canvas")).toBeInTheDocument();
  });

  it("初期倍率は 100% を表示する", () => {
    render(<App />);
    expect(zoomLabel()).toBe("100%");
  });

  it("拡大ボタンで倍率が上がる", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "拡大" }));
    expect(zoomLabel()).toBe("125%");
  });

  it("縮小ボタンで倍率が下がる", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "縮小" }));
    expect(zoomLabel()).toBe("80%");
  });

  it("倍率表示をクリックすると等倍に戻る", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "拡大" }));
    fireEvent.click(screen.getByRole("button", { name: "表示倍率をリセット" }));
    expect(zoomLabel()).toBe("100%");
  });

  it("拡大を繰り返しても上限を超えない", () => {
    render(<App />);
    const zoomIn = screen.getByRole("button", { name: "拡大" });
    for (let i = 0; i < 30; i += 1) {
      fireEvent.click(zoomIn);
    }
    expect(zoomLabel()).toBe(`${MAX_SCALE * 100}%`);
  });

  it("縮小を繰り返しても下限を下回らない", () => {
    render(<App />);
    const zoomOut = screen.getByRole("button", { name: "縮小" });
    for (let i = 0; i < 40; i += 1) {
      fireEvent.click(zoomOut);
    }
    expect(zoomLabel()).toBe(`${MIN_SCALE * 100}%`);
  });

  it("キャンバスのホイール操作が倍率表示に反映される", () => {
    render(<App />);
    fireEvent.wheel(screen.getByTestId("board-canvas"), {
      deltaY: -100,
      ctrlKey: true,
    });
    expect(zoomLabel()).not.toBe("100%");
  });
});
