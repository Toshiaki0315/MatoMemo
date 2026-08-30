import { describe, expect, it } from "vitest";
import { createShape, createStickyNote, type Item } from "./board";
import {
  ARROW_LENGTH,
  arrowHead,
  boundaryAnchor,
  connectorPath,
  sideAnchor,
  type ConnectorPath,
} from "./connectorPath";

/** 指定した位置・大きさの付箋。 */
function sticky(x: number, y: number, size = 100): Item {
  return createStickyNote({ id: `s-${x}-${y}`, x, y, width: size, height: size });
}

/** 折れ線として得られた点列を取り出す。 */
function points(path: ConnectorPath) {
  if (path.kind !== "polyline") {
    throw new Error("polyline ではありません");
  }
  return path.points;
}

describe("boundaryAnchor", () => {
  const bounds = { x: 0, y: 0, width: 100, height: 100 };

  it("右方向の点へは右辺で交わる", () => {
    expect(boundaryAnchor(bounds, { x: 500, y: 50 }, "rectangle")).toEqual({
      x: 100,
      y: 50,
    });
  });

  it("左方向の点へは左辺で交わる", () => {
    expect(boundaryAnchor(bounds, { x: -500, y: 50 }, "rectangle")).toEqual({
      x: 0,
      y: 50,
    });
  });

  it("上方向の点へは上辺で交わる", () => {
    expect(boundaryAnchor(bounds, { x: 50, y: -500 }, "rectangle")).toEqual({
      x: 50,
      y: 0,
    });
  });

  it("下方向の点へは下辺で交わる", () => {
    expect(boundaryAnchor(bounds, { x: 50, y: 500 }, "rectangle")).toEqual({
      x: 50,
      y: 100,
    });
  });

  it("斜め方向では角で交わる", () => {
    expect(boundaryAnchor(bounds, { x: 200, y: 200 }, "rectangle")).toEqual({
      x: 100,
      y: 100,
    });
  });

  it("円では楕円の縁で交わる", () => {
    const anchor = boundaryAnchor(bounds, { x: 200, y: 200 }, "ellipse");
    // 円周上なので中心からの距離は半径 50
    const dx = anchor.x - 50;
    const dy = anchor.y - 50;
    expect(Math.hypot(dx, dy)).toBeCloseTo(50, 10);
  });

  it("円でも真横なら矩形と同じ点になる", () => {
    expect(boundaryAnchor(bounds, { x: 500, y: 50 }, "ellipse")).toEqual({
      x: 100,
      y: 50,
    });
  });

  it("中心と同じ点なら中心を返す", () => {
    expect(boundaryAnchor(bounds, { x: 50, y: 50 }, "rectangle")).toEqual({
      x: 50,
      y: 50,
    });
    expect(boundaryAnchor(bounds, { x: 50, y: 50 }, "ellipse")).toEqual({
      x: 50,
      y: 50,
    });
  });

  it("大きさが 0 のアイテムでは中心を返す", () => {
    const flat = { x: 10, y: 10, width: 0, height: 0 };
    expect(boundaryAnchor(flat, { x: 100, y: 100 }, "ellipse")).toEqual({
      x: 10,
      y: 10,
    });
  });
});

describe("sideAnchor", () => {
  const bounds = { x: 0, y: 0, width: 100, height: 60 };

  it("辺の中点を返す", () => {
    expect(sideAnchor(bounds, "right")).toEqual({ x: 100, y: 30 });
    expect(sideAnchor(bounds, "left")).toEqual({ x: 0, y: 30 });
    expect(sideAnchor(bounds, "top")).toEqual({ x: 50, y: 0 });
    expect(sideAnchor(bounds, "bottom")).toEqual({ x: 50, y: 60 });
  });
});

describe("connectorPath: 直線", () => {
  it("互いの境界を結ぶ 2 点を返す", () => {
    const path = connectorPath("straight", sticky(0, 0), sticky(300, 0));
    expect(points(path)).toEqual([
      { x: 100, y: 50 },
      { x: 300, y: 50 },
    ]);
  });

  it("斜めの配置でも境界で止まる", () => {
    const path = connectorPath("straight", sticky(0, 0), sticky(300, 300));
    const [from, to] = points(path);
    // 始点は 1 枚目の内部・境界上にある
    expect(from?.x).toBeLessThanOrEqual(100);
    expect(from?.y).toBeLessThanOrEqual(100);
    expect(to?.x).toBeGreaterThanOrEqual(300);
    expect(to?.y).toBeGreaterThanOrEqual(300);
  });

  it("円は楕円の縁から引く", () => {
    const circle = createShape({
      id: "c",
      shape: "circle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const path = connectorPath("straight", circle, sticky(300, 300));
    const from = points(path)[0];
    expect(Math.hypot((from?.x ?? 0) - 50, (from?.y ?? 0) - 50)).toBeCloseTo(
      50,
      10,
    );
  });
});

describe("connectorPath: 折れ線", () => {
  it("横に並ぶ場合は水平・垂直・水平の 4 点になる", () => {
    const path = connectorPath("polyline", sticky(0, 0), sticky(300, 200));
    expect(points(path)).toEqual([
      { x: 100, y: 50 },
      { x: 200, y: 50 },
      { x: 200, y: 250 },
      { x: 300, y: 250 },
    ]);
  });

  it("縦に並ぶ場合は垂直・水平・垂直の 4 点になる", () => {
    const path = connectorPath("polyline", sticky(0, 0), sticky(200, 300));
    expect(points(path)).toEqual([
      { x: 50, y: 100 },
      { x: 50, y: 200 },
      { x: 250, y: 200 },
      { x: 250, y: 300 },
    ]);
  });

  it("右から左へも同じ形になる", () => {
    const path = connectorPath("polyline", sticky(300, 0), sticky(0, 0));
    expect(points(path)[0]).toEqual({ x: 300, y: 50 });
    expect(points(path).at(-1)).toEqual({ x: 100, y: 50 });
  });

  it("下から上へも同じ形になる", () => {
    const path = connectorPath("polyline", sticky(0, 300), sticky(0, 0));
    expect(points(path)[0]).toEqual({ x: 50, y: 300 });
    expect(points(path).at(-1)).toEqual({ x: 50, y: 100 });
  });

  it("すべての区間が水平か垂直になる", () => {
    const path = connectorPath("polyline", sticky(0, 0), sticky(370, 240));
    const list = points(path);
    for (let index = 1; index < list.length; index += 1) {
      const previous = list[index - 1];
      const current = list[index];
      const isOrthogonal =
        previous?.x === current?.x || previous?.y === current?.y;
      expect(isOrthogonal).toBe(true);
    }
  });
});

describe("connectorPath: 曲線", () => {
  it("3 次ベジェの制御点を返す", () => {
    const path = connectorPath("curved", sticky(0, 0), sticky(300, 0));
    expect(path.kind).toBe("curve");
    if (path.kind !== "curve") {
      throw new Error("curve ではありません");
    }
    expect(path.from).toEqual({ x: 100, y: 50 });
    expect(path.to).toEqual({ x: 300, y: 50 });
    // 横並びなので制御点は水平方向に張り出す
    expect(path.control1.y).toBe(50);
    expect(path.control2.y).toBe(50);
    expect(path.control1.x).toBeGreaterThan(path.from.x);
    expect(path.control2.x).toBeLessThan(path.to.x);
  });

  it("縦に並ぶ場合は制御点が垂直方向に張り出す", () => {
    const path = connectorPath("curved", sticky(0, 0), sticky(0, 300));
    if (path.kind !== "curve") {
      throw new Error("curve ではありません");
    }
    expect(path.control1.x).toBe(path.from.x);
    expect(path.control1.y).toBeGreaterThan(path.from.y);
    expect(path.control2.y).toBeLessThan(path.to.y);
  });

  it("上向きでも制御点の向きが反転する", () => {
    const path = connectorPath("curved", sticky(0, 300), sticky(0, 0));
    if (path.kind !== "curve") {
      throw new Error("curve ではありません");
    }
    expect(path.control1.y).toBeLessThan(path.from.y);
    expect(path.control2.y).toBeGreaterThan(path.to.y);
  });

  it("近すぎる場合でも制御点が最低限張り出す", () => {
    const path = connectorPath("curved", sticky(0, 0), sticky(101, 0));
    if (path.kind !== "curve") {
      throw new Error("curve ではありません");
    }
    expect(path.control1.x - path.from.x).toBeGreaterThanOrEqual(40);
  });

  it("左向きでも制御点の向きが反転する", () => {
    const path = connectorPath("curved", sticky(300, 0), sticky(0, 0));
    if (path.kind !== "curve") {
      throw new Error("curve ではありません");
    }
    expect(path.control1.x).toBeLessThan(path.from.x);
    expect(path.control2.x).toBeGreaterThan(path.to.x);
  });
});

describe("connectorPath: アイテムの移動への追従", () => {
  it("アイテムを動かすと経路も動く", () => {
    const before = connectorPath("straight", sticky(0, 0), sticky(300, 0));
    const after = connectorPath("straight", sticky(0, 0), sticky(500, 0));
    expect(points(before).at(-1)).not.toEqual(points(after).at(-1));
    expect(points(after).at(-1)).toEqual({ x: 500, y: 50 });
  });

  it("同じ位置なら同じ経路になる", () => {
    expect(connectorPath("straight", sticky(0, 0), sticky(300, 0))).toEqual(
      connectorPath("straight", sticky(0, 0), sticky(300, 0)),
    );
  });
});

describe("arrowHead", () => {
  it("直線では線の向きに合わせた 3 点を返す", () => {
    const head = arrowHead({
      kind: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    });
    expect(head?.tip).toEqual({ x: 100, y: 0 });
    // 右向きなので矢羽根は終点より左に開く
    expect(head?.left.x).toBeLessThan(100);
    expect(head?.right.x).toBeLessThan(100);
    // 線を挟んで上下に開く
    expect(
      Math.sign((head?.left.y ?? 0) * (head?.right.y ?? 0)),
    ).toBe(-1);
  });

  it("矢羽根の長さは一定になる", () => {
    const head = arrowHead({
      kind: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ],
    });
    const length = Math.hypot(
      (head?.left.x ?? 0) - (head?.tip.x ?? 0),
      (head?.left.y ?? 0) - (head?.tip.y ?? 0),
    );
    expect(length).toBeCloseTo(ARROW_LENGTH, 10);
  });

  it("折れ線では最後の区間の向きに合わせる", () => {
    const head = arrowHead({
      kind: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 100 },
      ],
    });
    // 最後の区間は下向きなので矢羽根は終点より上に開く
    expect(head?.left.y).toBeLessThan(100);
    expect(head?.right.y).toBeLessThan(100);
  });

  it("曲線では終端の制御点との向きに合わせる", () => {
    const head = arrowHead({
      kind: "curve",
      from: { x: 0, y: 0 },
      control1: { x: 40, y: 0 },
      control2: { x: 60, y: 100 },
      to: { x: 100, y: 100 },
    });
    expect(head?.tip).toEqual({ x: 100, y: 100 });
    expect(head?.left.x).toBeLessThan(100);
  });

  it("点が足りなければ矢印を作らない", () => {
    expect(arrowHead({ kind: "polyline", points: [] })).toBeNull();
    expect(
      arrowHead({ kind: "polyline", points: [{ x: 0, y: 0 }] }),
    ).toBeNull();
  });

  it("終点と手前の点が同じなら向きが決まらないので作らない", () => {
    expect(
      arrowHead({
        kind: "polyline",
        points: [
          { x: 10, y: 10 },
          { x: 10, y: 10 },
        ],
      }),
    ).toBeNull();
  });
});
