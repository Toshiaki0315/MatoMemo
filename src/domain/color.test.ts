import { describe, expect, it } from "vitest";
import { contrastRatio, parseHexColor, relativeLuminance } from "./color";

describe("parseHexColor", () => {
  it("6 桁の16進表記を読む", () => {
    expect(parseHexColor("#FF8800")).toEqual({ r: 255, g: 136, b: 0 });
  });

  it("3 桁の短縮表記を読む", () => {
    expect(parseHexColor("#F80")).toEqual({ r: 255, g: 136, b: 0 });
  });

  it("小文字も読む", () => {
    expect(parseHexColor("#ff8800")).toEqual({ r: 255, g: 136, b: 0 });
  });

  it("先頭の # は省略できる", () => {
    expect(parseHexColor("FF8800")).toEqual({ r: 255, g: 136, b: 0 });
  });

  it("不正な表記は例外にする", () => {
    expect(() => parseHexColor("#GGGGGG")).toThrow(/色/);
    expect(() => parseHexColor("#FF88")).toThrow(/色/);
  });
});

describe("relativeLuminance", () => {
  it("白の相対輝度は 1", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 10);
  });

  it("黒の相対輝度は 0", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 10);
  });

  it("暗い色ほど輝度が低い", () => {
    expect(relativeLuminance("#333333")).toBeLessThan(
      relativeLuminance("#CCCCCC"),
    );
  });

  it("低輝度側の線形部分も扱う", () => {
    // sRGB のガンマ補正は 0.03928 以下で線形式に切り替わる
    expect(relativeLuminance("#050505")).toBeGreaterThan(0);
    expect(relativeLuminance("#050505")).toBeLessThan(0.01);
  });
});

describe("contrastRatio", () => {
  it("白と黒のコントラスト比は 21", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 6);
  });

  it("同じ色同士は 1", () => {
    expect(contrastRatio("#4488CC", "#4488CC")).toBeCloseTo(1, 10);
  });

  it("引数の順序によらず同じ値を返す", () => {
    expect(contrastRatio("#FFFFFF", "#333333")).toBeCloseTo(
      contrastRatio("#333333", "#FFFFFF"),
      10,
    );
  });
});
