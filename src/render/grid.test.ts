import { describe, expect, it } from "vitest";
import { MAX_SCALE, MIN_SCALE, createViewport } from "../domain/viewport";
import {
  BASE_GRID_SPACING,
  MIN_GRID_SCREEN_SPACING,
  computeGridLines,
  gridSpacingForScale,
} from "./grid";

describe("gridSpacingForScale", () => {
  it("画面上の間隔を常に見やすい範囲に保つ", () => {
    // 0.1 刻みで倍率を走査し、どの倍率でも画面上の間隔が範囲に収まることを確かめる
    for (let scale = MIN_SCALE; scale <= MAX_SCALE; scale += 0.1) {
      const screenSpacing = gridSpacingForScale(scale) * scale;
      expect(screenSpacing).toBeGreaterThanOrEqual(MIN_GRID_SCREEN_SPACING);
      expect(screenSpacing).toBeLessThan(MIN_GRID_SCREEN_SPACING * 2);
    }
  });

  it("縮小すると間隔を粗くする", () => {
    expect(gridSpacingForScale(0.1)).toBeGreaterThan(gridSpacingForScale(1));
  });

  it("拡大すると間隔を細かくする", () => {
    expect(gridSpacingForScale(8)).toBeLessThan(gridSpacingForScale(1));
  });

  it("基準間隔の 2 のべき乗倍になる", () => {
    for (const scale of [0.1, 0.37, 1, 2.5, 8]) {
      const ratio = gridSpacingForScale(scale) / BASE_GRID_SPACING;
      expect(Number.isInteger(Math.log2(ratio))).toBe(true);
    }
  });
});

describe("computeGridLines", () => {
  it("画面全体を覆う縦横の線を返す", () => {
    const lines = computeGridLines(createViewport(), 200, 100);
    expect(lines.spacing).toBe(gridSpacingForScale(1));
    expect(lines.vertical.length).toBeGreaterThan(0);
    expect(lines.horizontal.length).toBeGreaterThan(0);
  });

  it("線はすべて画面内に収まる", () => {
    const lines = computeGridLines({ x: 13, y: -27, scale: 1.7 }, 300, 200);
    for (const x of lines.vertical) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(300);
    }
    for (const y of lines.horizontal) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(200);
    }
  });

  it("等倍・原点ではワールド座標の倍数に線が並ぶ", () => {
    const lines = computeGridLines(createViewport(), 200, 100);
    const spacing = lines.spacing;
    expect(lines.vertical[0]).toBe(0);
    expect(lines.vertical[1]).toBe(spacing);
  });

  it("パンすると線が同じだけずれる", () => {
    const base = computeGridLines({ x: 0, y: 0, scale: 1 }, 200, 100);
    const panned = computeGridLines({ x: 5, y: 0, scale: 1 }, 200, 100);
    expect(panned.vertical[0]).toBeCloseTo((base.vertical[0] ?? 0) + 5, 10);
  });

  it("画面サイズが 0 なら線を返さない", () => {
    const lines = computeGridLines(createViewport(), 0, 0);
    expect(lines.vertical).toEqual([]);
    expect(lines.horizontal).toEqual([]);
  });

  it("拡大しても線の本数が過大にならない", () => {
    const lines = computeGridLines({ x: 0, y: 0, scale: MAX_SCALE }, 1920, 1080);
    // 画面上の間隔は最低 MIN_GRID_SCREEN_SPACING px 空くので本数には上限がある
    expect(lines.vertical.length).toBeLessThanOrEqual(
      1920 / MIN_GRID_SCREEN_SPACING + 1,
    );
  });
});

describe("computeGridLines: 切り替わりのフェード", () => {
  const VIEW = { width: 400, height: 300 };

  /** その倍率での minor の濃さ。 */
  function alphaAt(scale: number) {
    return computeGridLines({ x: 0, y: 0, scale }, VIEW.width, VIEW.height)
      .minorAlpha;
  }

  it("濃さは 0 以上 1 未満に収まる", () => {
    for (let scale = MIN_SCALE; scale <= MAX_SCALE; scale += 0.01) {
      const alpha = alphaAt(scale);
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThan(1);
    }
  });

  it("間隔が切り替わった直後は見えない濃さから始まる", () => {
    // 0.48 倍でちょうど画面上 24px になり、間隔が切り替わる
    expect(alphaAt(0.48)).toBe(0);
  });

  it("次の切り替わりが近づくほど濃くなる", () => {
    expect(alphaAt(0.6)).toBeGreaterThan(alphaAt(0.5));
    expect(alphaAt(0.9)).toBeGreaterThan(alphaAt(0.6));
  });

  it("切り替わる直前はほぼ濃さ 1 に達している", () => {
    // 0.96 倍の直前。ここを越えると minor が実線に変わる
    expect(alphaAt(0.9599)).toBeGreaterThan(0.99);
  });

  it("切り替わりの前後で濃さが飛ばない", () => {
    // 直前の minor がほぼ濃さ 1 まで来ており、そのまま実線に変わる。
    // 直後の minor は 0 から始まるので、見た目の濃さは連続する
    expect(alphaAt(0.9599)).toBeGreaterThan(0.99);
    expect(alphaAt(0.9601)).toBeLessThan(0.01);
  });

  it("薄い線は実線のちょうど中間に並ぶ", () => {
    const lines = computeGridLines({ x: 0, y: 0, scale: 0.7 }, 400, 300);
    const [first, second] = lines.vertical;
    const middle = lines.minorVertical[0];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(middle).toBeCloseTo(((first ?? 0) + (second ?? 0)) / 2, 10);
  });

  it("薄い線も画面内に収まる", () => {
    const lines = computeGridLines({ x: 13, y: -27, scale: 1.7 }, 300, 200);
    for (const x of lines.minorVertical) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(300);
    }
    for (const y of lines.minorHorizontal) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(200);
    }
  });

  it("画面サイズが 0 なら薄い線も返さない", () => {
    const lines = computeGridLines(createViewport(), 0, 0);
    expect(lines.minorVertical).toEqual([]);
    expect(lines.minorHorizontal).toEqual([]);
  });
});
