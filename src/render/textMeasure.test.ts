import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockContext } from "../test/mockCanvas";
import {
  approximateTextWidth,
  createCanvasMeasurer,
  cssFont,
  fontSizeOf,
} from "./textMeasure";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cssFont", () => {
  it("大きさと書体から font 指定を作る", () => {
    expect(cssFont(20, "Hiragino Sans")).toBe('20px "Hiragino Sans", sans-serif');
  });
});

describe("fontSizeOf", () => {
  it("font 指定から大きさを読む", () => {
    expect(fontSizeOf('18.5px "Menlo", sans-serif')).toBe(18.5);
  });

  it("読み取れなければ 16 とする", () => {
    expect(fontSizeOf("bold serif")).toBe(16);
  });
});

describe("approximateTextWidth", () => {
  it("全角は 1em、半角は 0.55em と見積もる", () => {
    expect(approximateTextWidth("あa", "20px sans-serif")).toBe(20 + 11);
  });
});

describe("createCanvasMeasurer", () => {
  it("測定用の Canvas で測る", () => {
    const mock = createMockContext();
    vi.mocked(mock.ctx.measureText).mockReturnValue({ width: 42 } as TextMetrics);
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(mock.ctx as never);

    const measure = createCanvasMeasurer();
    expect(measure("abc", "12px sans-serif")).toBe(42);
    expect(mock.ctx.font).toBe("12px sans-serif");
    // 測定用の Canvas は 1 つだけ作って使い回す
    measure("def", "12px sans-serif");
    expect(getContext).toHaveBeenCalledTimes(1);
  });

  it("Canvas が使えなければ概算にする", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const measure = createCanvasMeasurer();
    expect(measure("あ", "10px sans-serif")).toBe(10);
  });
});
