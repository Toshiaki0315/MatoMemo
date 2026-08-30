import { describe, expect, it } from "vitest";
import { STROKE_STYLES } from "../domain/board";
import { dashPattern } from "./strokePattern";

describe("dashPattern", () => {
  it("実線は空のパターンにする", () => {
    expect(dashPattern("solid", 1)).toEqual([]);
  });

  it("破線・点線・一点鎖線はパターンを返す", () => {
    for (const style of ["dashed", "dotted", "dashDot"] as const) {
      expect(dashPattern(style, 1).length).toBeGreaterThan(0);
    }
  });

  it("線種ごとに異なるパターンにする", () => {
    const patterns = STROKE_STYLES.map((style) =>
      JSON.stringify(dashPattern(style, 1)),
    );
    expect(new Set(patterns).size).toBe(STROKE_STYLES.length);
  });

  it("拡大率で割り、画面上の見た目を保つ", () => {
    const atOne = dashPattern("dashed", 1);
    const atFour = dashPattern("dashed", 4);
    expect(atFour).toEqual(atOne.map((length) => length / 4));
  });
});
