import { describe, expect, it } from "vitest";
import {
  ROUTE_STUB,
  routeAround,
  segmentCrossesRect,
  simplifyRoute,
  straightenRoute,
} from "./connectorRoute";

const box = { x: 0, y: 0, width: 100, height: 100 };

describe("segmentCrossesRect", () => {
  it("内側を通る線分は通るとみなす", () => {
    expect(segmentCrossesRect({ x: -10, y: 50 }, { x: 110, y: 50 }, box)).toBe(true);
  });

  it("辺に沿うだけ・外を通るだけなら通らない", () => {
    expect(segmentCrossesRect({ x: -10, y: 0 }, { x: 110, y: 0 }, box)).toBe(false);
    expect(segmentCrossesRect({ x: -10, y: -5 }, { x: 110, y: -5 }, box)).toBe(false);
    expect(segmentCrossesRect({ x: 150, y: -10 }, { x: 150, y: 110 }, box)).toBe(false);
  });

  it("手前で止まる線分は通らない", () => {
    expect(segmentCrossesRect({ x: -50, y: 50 }, { x: -10, y: 50 }, box)).toBe(false);
  });
});

describe("simplifyRoute", () => {
  it("一直線に並ぶ途中の点と、重なった点を除く", () => {
    expect(
      simplifyRoute([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 10 },
        { x: 20, y: 30 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 30 },
    ]);
  });
});

describe("routeAround", () => {
  it("向かい合う辺は間の真ん中で渡す", () => {
    const other = { x: 300, y: 200, width: 100, height: 100 };
    expect(
      routeAround({ x: 100, y: 50 }, { x: 124, y: 50 }, { x: 300, y: 250 }, { x: 276, y: 250 }, [
        box,
        other,
      ]),
    ).toEqual([
      { x: 100, y: 50 },
      { x: 200, y: 50 },
      { x: 200, y: 250 },
      { x: 300, y: 250 },
    ]);
  });

  it("反対を向いた辺からは、自分の図形を回り込む", () => {
    // 上の辺から出て、真下の図形の上の辺へ入る
    const below = { x: 0, y: 300, width: 100, height: 100 };
    const route = routeAround(
      { x: 50, y: 0 },
      { x: 50, y: -ROUTE_STUB },
      { x: 50, y: 300 },
      { x: 50, y: 300 - ROUTE_STUB },
      [box, below],
    );
    expect(route?.[1]).toEqual({ x: 50, y: -ROUTE_STUB });
    // 途中の区間はどの図形の内側も通らない
    route?.slice(1).forEach((point, index) => {
      const from = route[index] as { x: number; y: number };
      expect(segmentCrossesRect(from, point, box)).toBe(false);
      expect(segmentCrossesRect(from, point, below)).toBe(false);
    });
  });

  it("図形が重なって接続ポイントがふさがれていれば null", () => {
    // 右の辺から出た先が、すっぽり別の図形の中にある
    const cover = { x: 90, y: -200, width: 400, height: 600 };
    expect(
      routeAround({ x: 100, y: 50 }, { x: 124, y: 50 }, { x: 0, y: 50 }, { x: -24, y: 50 }, [
        box,
        cover,
      ]),
    ).toBeNull();
  });
});

describe("straightenRoute", () => {
  const route = [
    { x: 100, y: 50 },
    { x: 124, y: 50 },
    { x: 124, y: -24 },
    { x: 300, y: -24 },
    { x: 300, y: 300 },
  ];

  it("見通せるところは斜めにまっすぐつなぐ", () => {
    // 先頭の 2 点（辺から垂直に出る部分）は残し、その先は終点へ直接向かう
    expect(straightenRoute(route, [box], 2, 1)).toEqual([
      { x: 100, y: 50 },
      { x: 124, y: 50 },
      { x: 300, y: 300 },
    ]);
  });

  it("図形にふさがれた区間は飛ばさない", () => {
    const wall = { x: 150, y: 0, width: 50, height: 400 };
    const result = straightenRoute(route, [box, wall], 2, 1);
    expect(result.length).toBeGreaterThan(3);
  });

  it("残す点だけで経路ができているなら、そのまま返す", () => {
    const short = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(straightenRoute(short, [], 1, 1)).toEqual(short);
  });
});
