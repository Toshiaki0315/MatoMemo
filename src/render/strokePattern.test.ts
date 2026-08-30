import { describe, expect, it } from "vitest";
import { STROKE_STYLES } from "../domain/board";
import { dashPattern } from "./strokePattern";

describe("dashPattern", () => {
  it("実線は空のパターンにする", () => {
    expect(dashPattern("solid", 1, 1)).toEqual([]);
  });

  it("破線・点線・一点鎖線はパターンを返す", () => {
    for (const style of ["dashed", "dotted", "dashDot"] as const) {
      expect(dashPattern(style, 1, 1).length).toBeGreaterThan(0);
    }
  });

  it("線種ごとに異なるパターンにする", () => {
    const patterns = STROKE_STYLES.map((style) =>
      JSON.stringify(dashPattern(style, 2, 1)),
    );
    expect(new Set(patterns).size).toBe(STROKE_STYLES.length);
  });

  it("拡大率で割り、画面上の見た目を保つ", () => {
    const atOne = dashPattern("dashed", 2, 1);
    const atFour = dashPattern("dashed", 2, 4);
    expect(atFour).toEqual(atOne.map((length) => length / 4));
  });
});

describe("dashPattern: 線の太さとの関係", () => {
  it("太い線ほど間隔を広く取る", () => {
    const thin = dashPattern("dashed", 3, 1);
    const thick = dashPattern("dashed", 8, 1);
    for (const index of [0, 1]) {
      expect(thick[index] as number).toBeGreaterThan(thin[index] as number);
    }
  });

  it("太さに比例する", () => {
    const at4 = dashPattern("dashed", 4, 1);
    const at8 = dashPattern("dashed", 8, 1);
    expect(at8).toEqual(at4.map((length) => length * 2));
  });

  it("細い線でも間隔が詰まりすぎない", () => {
    // 1px の線をそのまま倍率にすると 4px の破線になり実線に見える
    const hairline = dashPattern("dashed", 1, 1);
    expect(hairline[0] as number).toBeGreaterThanOrEqual(8);
  });

  it("下限より細い線どうしは同じ間隔になる", () => {
    expect(dashPattern("dashed", 1, 1)).toEqual(dashPattern("dashed", 2, 1));
  });

  it("どの線種でも太さに応じて広がる", () => {
    for (const style of ["dashed", "dotted", "dashDot"] as const) {
      const thin = dashPattern(style, 3, 1);
      const thick = dashPattern(style, 8, 1);
      expect(thick[0] as number).toBeGreaterThan(thin[0] as number);
    }
  });
});
