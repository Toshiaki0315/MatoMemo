import { describe, expect, it } from "vitest";
import {
  clamp,
  ellipseContainsPoint,
  rectCenter,
  rectContainsPoint,
  rectContainsRect,
  rectFromCorners,
  rectsIntersect,
} from "./geometry";

describe("clamp", () => {
  it("範囲内の値はそのまま返す", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("下限を下回る値は下限に丸める", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it("上限を上回る値は上限に丸める", () => {
    expect(clamp(42, 0, 10)).toBe(10);
  });

  it("境界値はそのまま返す", () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe("rectFromCorners", () => {
  it("左上→右下のドラッグから矩形を作る", () => {
    expect(rectFromCorners({ x: 1, y: 2 }, { x: 5, y: 8 })).toEqual({
      x: 1,
      y: 2,
      width: 4,
      height: 6,
    });
  });

  it("右下→左上のドラッグでも正規化された矩形を作る", () => {
    expect(rectFromCorners({ x: 5, y: 8 }, { x: 1, y: 2 })).toEqual({
      x: 1,
      y: 2,
      width: 4,
      height: 6,
    });
  });

  it("同一点からは幅・高さ 0 の矩形を作る", () => {
    expect(rectFromCorners({ x: 3, y: 3 }, { x: 3, y: 3 })).toEqual({
      x: 3,
      y: 3,
      width: 0,
      height: 0,
    });
  });
});

describe("rectCenter", () => {
  it("矩形の中心座標を返す", () => {
    expect(rectCenter({ x: 10, y: 20, width: 30, height: 40 })).toEqual({
      x: 25,
      y: 40,
    });
  });
});

describe("rectContainsPoint", () => {
  const rect = { x: 0, y: 0, width: 10, height: 10 };

  it("内部の点を含むと判定する", () => {
    expect(rectContainsPoint(rect, { x: 5, y: 5 })).toBe(true);
  });

  it("辺上の点を含むと判定する", () => {
    expect(rectContainsPoint(rect, { x: 0, y: 0 })).toBe(true);
    expect(rectContainsPoint(rect, { x: 10, y: 10 })).toBe(true);
  });

  it("外部の点は含まないと判定する", () => {
    expect(rectContainsPoint(rect, { x: -1, y: 5 })).toBe(false);
    expect(rectContainsPoint(rect, { x: 11, y: 5 })).toBe(false);
    expect(rectContainsPoint(rect, { x: 5, y: -1 })).toBe(false);
    expect(rectContainsPoint(rect, { x: 5, y: 11 })).toBe(false);
  });
});

describe("rectsIntersect", () => {
  const base = { x: 0, y: 0, width: 10, height: 10 };

  it("重なる矩形を検出する", () => {
    expect(rectsIntersect(base, { x: 5, y: 5, width: 10, height: 10 })).toBe(
      true,
    );
  });

  it("完全に内包する矩形を検出する", () => {
    expect(rectsIntersect(base, { x: 2, y: 2, width: 3, height: 3 })).toBe(true);
  });

  it("辺が接する矩形は重なりと判定する", () => {
    expect(rectsIntersect(base, { x: 10, y: 0, width: 5, height: 5 })).toBe(
      true,
    );
  });

  it("離れた矩形は重ならないと判定する", () => {
    expect(rectsIntersect(base, { x: 11, y: 0, width: 5, height: 5 })).toBe(
      false,
    );
    expect(rectsIntersect(base, { x: 0, y: 11, width: 5, height: 5 })).toBe(
      false,
    );
    expect(rectsIntersect(base, { x: -6, y: 0, width: 5, height: 5 })).toBe(
      false,
    );
    expect(rectsIntersect(base, { x: 0, y: -6, width: 5, height: 5 })).toBe(
      false,
    );
  });
});

describe("ellipseContainsPoint", () => {
  const rect = { x: 0, y: 0, width: 100, height: 50 };

  it("中心を含むと判定する", () => {
    expect(ellipseContainsPoint(rect, { x: 50, y: 25 })).toBe(true);
  });

  it("縁上の点を含むと判定する", () => {
    expect(ellipseContainsPoint(rect, { x: 0, y: 25 })).toBe(true);
    expect(ellipseContainsPoint(rect, { x: 50, y: 0 })).toBe(true);
  });

  it("外接矩形の角は含まないと判定する", () => {
    expect(ellipseContainsPoint(rect, { x: 0, y: 0 })).toBe(false);
    expect(ellipseContainsPoint(rect, { x: 100, y: 50 })).toBe(false);
  });

  it("外部の点は含まないと判定する", () => {
    expect(ellipseContainsPoint(rect, { x: -10, y: 25 })).toBe(false);
  });

  it("幅または高さが 0 なら常に含まないと判定する", () => {
    expect(
      ellipseContainsPoint({ x: 0, y: 0, width: 0, height: 50 }, { x: 0, y: 25 }),
    ).toBe(false);
    expect(
      ellipseContainsPoint({ x: 0, y: 0, width: 50, height: 0 }, { x: 25, y: 0 }),
    ).toBe(false);
  });
});

describe("rectContainsRect", () => {
  const outer = { x: 0, y: 0, width: 100, height: 100 };

  it("完全に含まれる矩形を検出する", () => {
    expect(rectContainsRect(outer, { x: 10, y: 10, width: 20, height: 20 })).toBe(
      true,
    );
  });

  it("辺が一致する矩形も含まれると判定する", () => {
    expect(rectContainsRect(outer, outer)).toBe(true);
  });

  it("はみ出す矩形は含まれないと判定する", () => {
    expect(rectContainsRect(outer, { x: -1, y: 0, width: 20, height: 20 })).toBe(
      false,
    );
    expect(rectContainsRect(outer, { x: 0, y: -1, width: 20, height: 20 })).toBe(
      false,
    );
    expect(rectContainsRect(outer, { x: 90, y: 0, width: 20, height: 20 })).toBe(
      false,
    );
    expect(rectContainsRect(outer, { x: 0, y: 90, width: 20, height: 20 })).toBe(
      false,
    );
  });
});
