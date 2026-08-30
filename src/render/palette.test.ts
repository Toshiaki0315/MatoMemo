import { describe, expect, it } from "vitest";
import { STICKY_COLORS } from "../domain/board";
import { contrastRatio } from "../domain/color";
import {
  ITEM_TEXT_COLOR,
  MIN_TEXT_CONTRAST,
  STICKY_PALETTE,
} from "./palette";

describe("STICKY_PALETTE", () => {
  it("6 色すべてを定義している", () => {
    for (const color of STICKY_COLORS) {
      expect(STICKY_PALETTE[color]).toBeDefined();
    }
    expect(Object.keys(STICKY_PALETTE)).toHaveLength(STICKY_COLORS.length);
  });

  it("すべての色でテキストが WCAG AA のコントラストを満たす", () => {
    for (const color of STICKY_COLORS) {
      const ratio = contrastRatio(STICKY_PALETTE[color].fill, ITEM_TEXT_COLOR);
      expect(
        ratio,
        `${color} のコントラスト比が不足しています: ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });

  it("薄いパステル色である（白に近い明るさを保つ）", () => {
    for (const color of STICKY_COLORS) {
      // 白とのコントラスト比が小さい = 白に近い明るさ
      expect(
        contrastRatio(STICKY_PALETTE[color].fill, "#FFFFFF"),
      ).toBeLessThan(1.7);
    }
  });

  it("枠線は塗りより濃い", () => {
    for (const color of STICKY_COLORS) {
      const { fill, border } = STICKY_PALETTE[color];
      expect(contrastRatio(border, "#000000")).toBeLessThan(
        contrastRatio(fill, "#000000"),
      );
    }
  });

  it("色が互いに区別できる（塗りが重複しない）", () => {
    const fills = STICKY_COLORS.map((color) => STICKY_PALETTE[color].fill);
    expect(new Set(fills).size).toBe(fills.length);
  });
});
