import { describe, expect, it } from "vitest";
import {
  ANCHOR_SIDES,
  createConnector,
  createShape,
  createStickyNote,
  ROUNDED_CORNER_RADIUS,
  type Item,
  type ShapeKind,
} from "./board";
import {
  CAP_LENGTHS,
  ROUTE_STUB,
  anchorPoints,
  anchorSideNear,
  pathOfConnector,
  arrowDepth,
  arrowHead,
  bendForPoint,
  bendSegment,
  capLength,
  trimPath,
  connectorEnds,
  boundaryAnchor,
  connectorPath,
  anchorPosition,
  sideAnchor,
  type ConnectorPath,
} from "./connectorPath";

/** 指定した位置・大きさの付箋。 */
function sticky(x: number, y: number, size = 100): Item {
  return createStickyNote({ id: `s-${x}-${y}`, x, y, width: size, height: size });
}

/** 指定した種類・位置・大きさの図形。 */
function shape(kind: ShapeKind, x: number, y: number, width: number, height: number): Item {
  return createShape({ id: `${kind}-${x}-${y}`, shape: kind, x, y, width, height });
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

  it("折れる位置を指定できる (横並び)", () => {
    // 始点 x:100、終点 x:300 の間の 1/4 の位置で折れる
    const path = connectorPath("polyline", sticky(0, 0), sticky(300, 200), 0.25);
    expect(points(path)).toEqual([
      { x: 100, y: 50 },
      { x: 150, y: 50 },
      { x: 150, y: 250 },
      { x: 300, y: 250 },
    ]);
  });

  it("折れる位置を指定できる (縦並び)", () => {
    const path = connectorPath("polyline", sticky(0, 0), sticky(200, 300), 0.25);
    expect(points(path)).toEqual([
      { x: 50, y: 100 },
      { x: 50, y: 150 },
      { x: 250, y: 150 },
      { x: 250, y: 300 },
    ]);
  });

  it("端まで寄せても経路が潰れない", () => {
    // 0 や 1 ちょうどまで寄せると区間の長さが 0 になり、
    // 矢印の向きが決められなくなる。少し内側で止まる。
    const path = connectorPath("polyline", sticky(0, 0), sticky(300, 200), 0);
    const list = points(path);
    expect(list[1]?.x).toBeGreaterThan(100);
    const path2 = connectorPath("polyline", sticky(0, 0), sticky(300, 200), 1);
    expect(points(path2)[1]?.x).toBeLessThan(300);
  });
});

describe("bendForPoint", () => {
  it("横並びではドラッグ先の x から割合を求める", () => {
    // 始点 x:100、終点 x:300 → x:150 は 1/4 の位置
    expect(bendForPoint(sticky(0, 0), sticky(300, 200), { x: 150, y: 999 })).toBe(
      0.25,
    );
  });

  it("縦並びではドラッグ先の y から割合を求める", () => {
    expect(bendForPoint(sticky(0, 0), sticky(200, 300), { x: 999, y: 150 })).toBe(
      0.25,
    );
  });

  it("範囲の外へ引いても有効な範囲に丸める", () => {
    const bend = bendForPoint(sticky(0, 0), sticky(300, 200), { x: -500, y: 0 });
    expect(bend).toBeGreaterThan(0);
    const far = bendForPoint(sticky(0, 0), sticky(300, 200), { x: 900, y: 0 });
    expect(far).toBeLessThan(1);
  });

  it("端点が同じ位置で按分できない場合は null", () => {
    // 辺同士が接していて始点と終点の x が一致する
    expect(
      bendForPoint(sticky(0, 0), sticky(100, 0), { x: 100, y: 50 }),
    ).toBeNull();
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
    expect(length).toBeCloseTo(CAP_LENGTHS.medium, 10);
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

describe("connectorEnds", () => {
  it("折れ線の両端を返す", () => {
    expect(
      connectorEnds({
        kind: "polyline",
        points: [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 100, y: 100 },
        ],
      }),
    ).toEqual([
      { end: "from", point: { x: 0, y: 0 } },
      { end: "to", point: { x: 100, y: 100 } },
    ]);
  });

  it("曲線の両端を返す", () => {
    expect(
      connectorEnds({
        kind: "curve",
        from: { x: 0, y: 0 },
        control1: { x: 40, y: 0 },
        control2: { x: 60, y: 100 },
        to: { x: 100, y: 100 },
      }),
    ).toEqual([
      { end: "from", point: { x: 0, y: 0 } },
      { end: "to", point: { x: 100, y: 100 } },
    ]);
  });

  it("点が無ければ空を返す", () => {
    expect(connectorEnds({ kind: "polyline", points: [] })).toEqual([]);
  });
});

describe("arrowHead: 始点側", () => {
  it("始点を頂点にする", () => {
    const head = arrowHead(
      {
        kind: "polyline",
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
      },
      "from",
    );
    expect(head?.tip).toEqual({ x: 0, y: 0 });
    // 左向きなので矢羽根は始点より右へ開く
    expect(head?.left.x).toBeGreaterThan(0);
    expect(head?.right.x).toBeGreaterThan(0);
  });

  it("折れ線では最初の区間の向きに合わせる", () => {
    const head = arrowHead(
      {
        kind: "polyline",
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 100 },
          { x: 100, y: 100 },
        ],
      },
      "from",
    );
    // 最初の区間は下向きなので矢羽根は始点より下へ開く
    expect(head?.left.y).toBeGreaterThan(0);
    expect(head?.right.y).toBeGreaterThan(0);
  });

  it("曲線では始点側の制御点との向きに合わせる", () => {
    const head = arrowHead(
      {
        kind: "curve",
        from: { x: 0, y: 0 },
        control1: { x: 40, y: 0 },
        control2: { x: 60, y: 100 },
        to: { x: 100, y: 100 },
      },
      "from",
    );
    expect(head?.tip).toEqual({ x: 0, y: 0 });
    expect(head?.left.x).toBeGreaterThan(0);
  });

  it("点が足りなければ作らない", () => {
    expect(
      arrowHead({ kind: "polyline", points: [{ x: 0, y: 0 }] }, "from"),
    ).toBeNull();
  });
});

describe("arrowHead: 大きさ", () => {
  const path = {
    kind: "polyline",
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
  } as const;

  it("指定した長さの矢羽根を作る", () => {
    const head = arrowHead(path, "to", 30);
    expect(
      Math.hypot(
        (head?.left.x ?? 0) - (head?.tip.x ?? 0),
        (head?.left.y ?? 0) - (head?.tip.y ?? 0),
      ),
    ).toBeCloseTo(30, 10);
  });

  it("大きさの指定は小・中・大で異なる", () => {
    expect(CAP_LENGTHS.small).toBeLessThan(CAP_LENGTHS.medium);
    expect(CAP_LENGTHS.medium).toBeLessThan(CAP_LENGTHS.large);
  });
});

describe("capLength", () => {
  it("細い線では設定した大きさをそのまま使う", () => {
    expect(capLength("small", 1)).toBe(CAP_LENGTHS.small);
    expect(capLength("medium", 1)).toBe(CAP_LENGTHS.medium);
    expect(capLength("large", 1)).toBe(CAP_LENGTHS.large);
  });

  it("既定の太さでも見た目は変わらない", () => {
    expect(capLength("medium", 2)).toBe(CAP_LENGTHS.medium);
  });

  it("太い線では太さに応じて大きくする", () => {
    expect(capLength("medium", 8)).toBeGreaterThan(CAP_LENGTHS.medium);
  });

  it("太さに比例して大きくなる", () => {
    expect(capLength("medium", 16)).toBe(capLength("medium", 8) * 2);
  });

  it("同じ太さなら 小 < 中 < 大 の順になる", () => {
    expect(capLength("small", 8)).toBeLessThan(capLength("medium", 8));
    expect(capLength("medium", 8)).toBeLessThan(capLength("large", 8));
  });

  it("線より十分に大きく、向きが読み取れる", () => {
    for (const width of [1, 2, 3, 5, 8]) {
      expect(capLength("medium", width)).toBeGreaterThanOrEqual(width * 2);
    }
  });
});

describe("arrowDepth", () => {
  it("矢羽根の付け根までの奥行きを返す", () => {
    // 付け根は先端から少し手前にあるので、長さより短い
    expect(arrowDepth(20)).toBeLessThan(20);
    expect(arrowDepth(20)).toBeGreaterThan(0);
  });

  it("長さに比例する", () => {
    expect(arrowDepth(40)).toBeCloseTo(arrowDepth(20) * 2, 10);
  });

  it("矢羽根の 2 点を先端方向へ射影した位置と一致する", () => {
    const head = arrowHead(
      {
        kind: "polyline",
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
      },
      "to",
      20,
    );
    // 右向きの矢印なので、付け根の x は先端から arrowDepth だけ手前
    expect(head?.left.x).toBeCloseTo(100 - arrowDepth(20), 10);
  });
});

describe("trimPath", () => {
  const straight = {
    kind: "polyline",
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
  } as const;

  /** 折れ線として点列を取り出す。 */
  function pointsOf(path: ConnectorPath) {
    if (path.kind !== "polyline") {
      throw new Error("polyline ではありません");
    }
    return path.points;
  }

  it("終点を線の向きに沿って手前へ引っ込める", () => {
    expect(pointsOf(trimPath(straight, "to", 20)).at(-1)).toEqual({
      x: 80,
      y: 0,
    });
  });

  it("始点も引っ込められる", () => {
    expect(pointsOf(trimPath(straight, "from", 20))[0]).toEqual({
      x: 20,
      y: 0,
    });
  });

  it("反対側の端は動かさない", () => {
    expect(pointsOf(trimPath(straight, "to", 20))[0]).toEqual({ x: 0, y: 0 });
  });

  it("斜めの線でも向きに沿って引っ込める", () => {
    const diagonal = {
      kind: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 30, y: 40 },
      ],
    } as const;
    const end = pointsOf(trimPath(diagonal, "to", 10)).at(-1);
    // 長さ 50 の線を 10 縮めるので、終点は 4/5 の位置
    expect(end?.x).toBeCloseTo(24, 10);
    expect(end?.y).toBeCloseTo(32, 10);
  });

  it("折れ線では最後の区間だけを縮める", () => {
    const elbow = {
      kind: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 100 },
      ],
    } as const;
    const points = pointsOf(trimPath(elbow, "to", 20));
    expect(points).toHaveLength(3);
    expect(points[1]).toEqual({ x: 50, y: 0 });
    expect(points.at(-1)).toEqual({ x: 50, y: 80 });
  });

  it("区間より長く縮めようとしても区間を越えない", () => {
    const end = pointsOf(trimPath(straight, "to", 500)).at(-1);
    expect(end?.x).toBeGreaterThan(0);
    expect(end?.x).toBeLessThan(100);
  });

  it("長さ 0 の区間では何もしない", () => {
    const degenerate = {
      kind: "polyline",
      points: [
        { x: 10, y: 10 },
        { x: 10, y: 10 },
      ],
    } as const;
    expect(trimPath(degenerate, "to", 20)).toEqual(degenerate);
  });

  it("点が足りなければそのまま返す", () => {
    const single = { kind: "polyline", points: [{ x: 0, y: 0 }] } as const;
    expect(trimPath(single, "to", 20)).toEqual(single);
  });

  it("縮める距離が 0 ならそのまま返す", () => {
    expect(trimPath(straight, "to", 0)).toEqual(straight);
  });

  it("曲線は終端の制御点の向きに沿って引っ込める", () => {
    const curve = {
      kind: "curve",
      from: { x: 0, y: 0 },
      control1: { x: 40, y: 0 },
      control2: { x: 80, y: 0 },
      to: { x: 100, y: 0 },
    } as const;
    const trimmed = trimPath(curve, "to", 10);
    if (trimmed.kind !== "curve") {
      throw new Error("curve ではありません");
    }
    expect(trimmed.to).toEqual({ x: 90, y: 0 });
    expect(trimmed.from).toEqual({ x: 0, y: 0 });
  });

  it("曲線の端と制御点が重なっていればそのまま返す", () => {
    // 向きが決まらないので縮めようがない
    const degenerate = {
      kind: "curve",
      from: { x: 0, y: 0 },
      control1: { x: 40, y: 0 },
      control2: { x: 100, y: 0 },
      to: { x: 100, y: 0 },
    } as const;
    expect(trimPath(degenerate, "to", 10)).toEqual(degenerate);
  });

  it("曲線の始点側も引っ込められる", () => {
    const curve = {
      kind: "curve",
      from: { x: 0, y: 0 },
      control1: { x: 20, y: 0 },
      control2: { x: 80, y: 0 },
      to: { x: 100, y: 0 },
    } as const;
    const trimmed = trimPath(curve, "from", 10);
    if (trimmed.kind !== "curve") {
      throw new Error("curve ではありません");
    }
    expect(trimmed.from).toEqual({ x: 10, y: 0 });
  });
});

describe("bendSegment", () => {
  it("折れ線の中間の線の 2 点を返す", () => {
    const path = {
      kind: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 100 },
      ],
    } as const;
    expect(bendSegment(path)).toEqual({
      a: { x: 50, y: 0 },
      b: { x: 50, y: 100 },
    });
  });

  it("直線 (2 点) には中間の線が無いので null", () => {
    const path = {
      kind: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    } as const;
    expect(bendSegment(path)).toBeNull();
  });

  it("点が 1 つしかなければ null", () => {
    const path = { kind: "polyline", points: [{ x: 0, y: 0 }] } as const;
    expect(bendSegment(path)).toBeNull();
  });

  it("曲線には中間の線が無いので null", () => {
    const path = {
      kind: "curve",
      from: { x: 0, y: 0 },
      control1: { x: 40, y: 0 },
      control2: { x: 80, y: 0 },
      to: { x: 100, y: 0 },
    } as const;
    expect(bendSegment(path)).toBeNull();
  });
});

describe("connectorPath: 接続ポイントの指定", () => {
  /** 経路のすべての区間が水平か垂直かを確かめる。 */
  function expectOrthogonal(list: readonly { x: number; y: number }[]) {
    for (let index = 1; index < list.length; index += 1) {
      const previous = list[index - 1];
      const current = list[index];
      expect(previous?.x === current?.x || previous?.y === current?.y).toBe(
        true,
      );
    }
  }

  describe("直線", () => {
    it("指定した端は辺の中点につなぐ", () => {
      const path = connectorPath("straight", sticky(0, 0), sticky(300, 0), 0.5, {
        from: "top",
      });
      expect(points(path)[0]).toEqual({ x: 50, y: 0 });
    });

    it("指定した辺からは垂直に少し出てから相手へ向かう", () => {
      // そのまま斜めに引くと、線が自分の下を通って隠れてしまう
      const path = connectorPath("straight", sticky(0, 0), sticky(300, 0), 0.5, {
        from: "bottom",
      });
      expect(points(path).slice(0, 2)).toEqual([
        { x: 50, y: 100 },
        { x: 50, y: 100 + ROUTE_STUB },
      ]);
    });

    it("自動の端は、相手が辺から出た先の方を向いて輪郭と交わる", () => {
      // 終点は (300,0)-(400,100) の付箋。左の辺のどこかで交わる
      const path = connectorPath("straight", sticky(0, 0), sticky(300, 0), 0.5, {
        from: "bottom",
      });
      expect(points(path)).toHaveLength(3);
      expect(points(path).at(-1)?.x).toBe(300);
    });

    it("両端を指定できる", () => {
      const path = connectorPath("straight", sticky(0, 0), sticky(300, 0), 0.5, {
        from: "bottom",
        to: "top",
      });
      expect(points(path)).toEqual([
        { x: 50, y: 100 },
        { x: 50, y: 100 + ROUTE_STUB },
        { x: 350, y: -ROUTE_STUB },
        { x: 350, y: 0 },
      ]);
      // 4 点でも折れ線の中間の線ではないので、折れ位置は動かせない
      expect(bendSegment(path)).toBeNull();
    });
  });

  describe("曲線", () => {
    it("指定した辺から垂直に出る", () => {
      const path = connectorPath("curved", sticky(0, 0), sticky(300, 0), 0.5, {
        from: "top",
        to: "top",
      });
      if (path.kind !== "curve") {
        throw new Error("curve ではありません");
      }
      expect(path.from).toEqual({ x: 50, y: 0 });
      expect(path.control1.x).toBe(50);
      expect(path.control1.y).toBeLessThan(0);
      expect(path.to).toEqual({ x: 350, y: 0 });
      expect(path.control2.y).toBeLessThan(0);
    });
  });

  describe("折れ線", () => {
    it("向かい合う辺どうしは真ん中で一度だけ渡す", () => {
      const path = connectorPath("polyline", sticky(0, 0), sticky(300, 200), 0.25, {
        from: "right",
        to: "left",
      });
      // 接続ポイントを指定すると折れる位置の割合は使わない
      expect(points(path)).toEqual([
        { x: 100, y: 50 },
        { x: 200, y: 50 },
        { x: 200, y: 250 },
        { x: 300, y: 250 },
      ]);
    });

    it("同じ向きの辺どうしは外側へ回り込む", () => {
      const path = connectorPath("polyline", sticky(0, 0), sticky(300, 200), 0.5, {
        from: "top",
        to: "top",
      });
      const list = points(path);
      expect(list[0]).toEqual({ x: 50, y: 0 });
      expect(list.at(-1)).toEqual({ x: 350, y: 200 });
      // 両方の辺より上（外側）を通る
      expect(list[1]?.y).toBe(-ROUTE_STUB);
      expectOrthogonal(list);
    });

    it("右向きどうしも外側へ回り込む", () => {
      const path = connectorPath("polyline", sticky(0, 0), sticky(300, 200), 0.5, {
        from: "right",
        to: "right",
      });
      const list = points(path);
      expect(list[1]?.x).toBe(400 + ROUTE_STUB);
      expectOrthogonal(list);
    });

    it("背中合わせの辺どうしは間を横切って回り込む", () => {
      // 始点は左の辺、終点は右の辺。終点の付箋は始点より左上にある
      const path = connectorPath("polyline", sticky(300, 300), sticky(0, 0), 0.5, {
        from: "right",
        to: "left",
      });
      const list = points(path);
      expect(list).toHaveLength(6);
      expect(list[0]).toEqual({ x: 400, y: 350 });
      expect(list.at(-1)).toEqual({ x: 0, y: 50 });
      expectOrthogonal(list);
    });

    it("縦向きどうしで向かい合うときも一度だけ渡す", () => {
      const path = connectorPath("polyline", sticky(0, 0), sticky(200, 300), 0.5, {
        from: "bottom",
        to: "top",
      });
      expect(points(path)).toEqual([
        { x: 50, y: 100 },
        { x: 50, y: 200 },
        { x: 250, y: 200 },
        { x: 250, y: 300 },
      ]);
    });

    it("横と縦の辺は、曲がれる向きなら角 1 つでつなぐ", () => {
      // 右の辺から出て、右下にある付箋の上の辺へ入る
      const path = connectorPath("polyline", sticky(0, 0), sticky(300, 300), 0.5, {
        from: "right",
        to: "top",
      });
      expect(points(path)).toEqual([
        { x: 100, y: 50 },
        { x: 350, y: 50 },
        { x: 350, y: 300 },
      ]);
    });

    it("縦と横の辺も角 1 つでつなぐ", () => {
      const path = connectorPath("polyline", sticky(0, 0), sticky(300, 300), 0.5, {
        from: "bottom",
        to: "left",
      });
      expect(points(path)).toEqual([
        { x: 50, y: 100 },
        { x: 50, y: 350 },
        { x: 300, y: 350 },
      ]);
    });

    it("曲がれない向きなら辺から少し出てから回り込む", () => {
      // 右の辺から出て、左下にある付箋の上の辺へ入る
      const path = connectorPath("polyline", sticky(300, 0), sticky(0, 300), 0.5, {
        from: "right",
        to: "top",
      });
      const list = points(path);
      expect(list).toHaveLength(5);
      expect(list[1]).toEqual({ x: 400 + ROUTE_STUB, y: 50 });
      expectOrthogonal(list);
    });

    it("縦から出て曲がれない向きでも回り込む", () => {
      const path = connectorPath("polyline", sticky(0, 300), sticky(300, 0), 0.5, {
        from: "bottom",
        to: "left",
      });
      const list = points(path);
      expect(list).toHaveLength(5);
      expectOrthogonal(list);
    });

    it("片方だけ指定したときは、もう片方を向かい合う辺にする", () => {
      const path = connectorPath("polyline", sticky(0, 0), sticky(300, 0), 0.5, {
        from: "top",
      });
      const list = points(path);
      expect(list[0]).toEqual({ x: 50, y: 0 });
      expect(list.at(-1)).toEqual({ x: 300, y: 50 });
      expectOrthogonal(list);
    });

    it("接続ポイントを指定した折れ線は、折れる位置を動かせない", () => {
      const path = connectorPath("polyline", sticky(0, 0), sticky(300, 200), 0.5, {
        from: "right",
        to: "left",
      });
      expect(bendSegment(path)).toBeNull();
    });
  });
});

describe("connectorPath: 角の接続ポイント", () => {
  describe("直線", () => {
    it("見通せる相手へは、角からまっすぐ斜めに結ぶ", () => {
      const path = connectorPath("straight", sticky(0, 0), sticky(300, 300), 0.5, {
        from: "bottomRight",
        to: "topLeft",
      });
      expect(points(path)).toEqual([
        { x: 100, y: 100 },
        { x: 300, y: 300 },
      ]);
    });

    it("自動の端は、角の方を向いて輪郭と交わる", () => {
      const path = connectorPath("straight", sticky(0, 0), sticky(300, 0), 0.5, {
        from: "topRight",
      });
      // 角 (100,0) から、相手の中心 (350,50) へ向かう線の上で左の辺と交わる
      expect(points(path)[0]).toEqual({ x: 100, y: 0 });
      expect(points(path)[1]?.x).toBe(300);
      expect(points(path)).toHaveLength(2);
    });

    it("終点だけ角を指定しても、始点は角の方を向いて輪郭と交わる", () => {
      const path = connectorPath("straight", sticky(0, 0), sticky(300, 300), 0.5, {
        to: "topLeft",
      });
      expect(points(path)).toEqual([
        { x: 100, y: 100 },
        { x: 300, y: 300 },
      ]);
    });

    it("円の角からも、見通せれば楕円の上の点からまっすぐ結ぶ", () => {
      const circle = shape("circle", 0, 0, 100, 100);
      const path = connectorPath("straight", circle, sticky(300, 300), 0.5, {
        from: "bottomRight",
      });
      expect(points(path)).toHaveLength(2);
      expect(points(path)[0]).toEqual(anchorPosition(circle, "bottomRight"));
    });

    it("相手が角の反対側にいれば、図形を回り込む", () => {
      const path = connectorPath("straight", sticky(0, 0), sticky(-300, 300), 0.5, {
        from: "topRight",
        to: "bottomRight",
      });
      expect(points(path)[0]).toEqual({ x: 100, y: 0 });
      expect(points(path).length).toBeGreaterThan(2);
    });

    it("辺を指定した相手へは、相手の辺から垂直に入る", () => {
      const path = connectorPath("straight", sticky(0, 0), sticky(300, 300), 0.5, {
        from: "bottomRight",
        to: "left",
      });
      expect(points(path)[0]).toEqual({ x: 100, y: 100 });
      expect(points(path).slice(-2)).toEqual([
        { x: 300 - ROUTE_STUB, y: 350 },
        { x: 300, y: 350 },
      ]);
    });
  });

  describe("折れ線", () => {
    it("角からは、相手がより先にある向き（横）へ出る", () => {
      const path = connectorPath("polyline", sticky(0, 0), sticky(400, -100), 0.5, {
        from: "topRight",
        to: "left",
      });
      expect(points(path)).toEqual([
        { x: 100, y: 0 },
        { x: 250, y: 0 },
        { x: 250, y: -50 },
        { x: 400, y: -50 },
      ]);
    });

    it("角からは、相手がより先にある向き（縦）へ出る", () => {
      const path = connectorPath("polyline", sticky(0, 0), sticky(100, -400), 0.5, {
        from: "topRight",
        to: "bottom",
      });
      expect(points(path)).toEqual([
        { x: 100, y: 0 },
        { x: 100, y: -150 },
        { x: 150, y: -150 },
        { x: 150, y: -300 },
      ]);
    });

    it("円の角からは、楕円の上の点から出る", () => {
      const circle = shape("circle", 0, 0, 100, 100);
      const path = connectorPath("polyline", circle, sticky(400, -100), 0.5, {
        from: "topRight",
        to: "left",
      });
      const start = anchorPosition(circle, "topRight");
      expect(points(path).slice(0, 2)).toEqual([start, { x: 250, y: start.y }]);
    });
  });

  describe("曲線", () => {
    it("矩形の角からは斜め 45° に出る", () => {
      const path = connectorPath("curved", sticky(0, 0), sticky(300, 300), 0.5, {
        from: "bottomRight",
        to: "topLeft",
      });
      if (path.kind !== "curve") {
        throw new Error("curve ではありません");
      }
      expect(path.from).toEqual({ x: 100, y: 100 });
      expect(path.control1.x - 100).toBeCloseTo(path.control1.y - 100, 10);
      expect(path.control1.x).toBeGreaterThan(100);
      expect(path.control2.x - 300).toBeCloseTo(path.control2.y - 300, 10);
      expect(path.control2.x).toBeLessThan(300);
    });

    it("円の角からは楕円に垂直な向きに出る", () => {
      const circle = shape("circle", 0, 0, 200, 100);
      const path = connectorPath("curved", circle, sticky(400, 300), 0.5, {
        from: "bottomRight",
      });
      if (path.kind !== "curve") {
        throw new Error("curve ではありません");
      }
      // 楕円 (x/100)^2 + (y/50)^2 = 1 の法線は (x/100^2, y/50^2) の向き
      const start = path.from;
      const normal = { x: (start.x - 100) / 100 ** 2, y: (start.y - 50) / 50 ** 2 };
      const out = { x: path.control1.x - start.x, y: path.control1.y - start.y };
      expect(normal.x * out.y - normal.y * out.x).toBeCloseTo(0, 10);
      expect(out.x).toBeGreaterThan(0);
    });
  });
});

describe("anchorPoints", () => {
  it("上下左右の辺の中点と 4 つの角の 8 点を、上から時計回りに返す", () => {
    expect(anchorPoints(sticky(0, 0))).toEqual([
      { side: "top", point: { x: 50, y: 0 } },
      { side: "topRight", point: { x: 100, y: 0 } },
      { side: "right", point: { x: 100, y: 50 } },
      { side: "bottomRight", point: { x: 100, y: 100 } },
      { side: "bottom", point: { x: 50, y: 100 } },
      { side: "bottomLeft", point: { x: 0, y: 100 } },
      { side: "left", point: { x: 0, y: 50 } },
      { side: "topLeft", point: { x: 0, y: 0 } },
    ]);
  });

  it("円の角の接続ポイントは、楕円の上の斜め 45° の位置に置く", () => {
    const circle = shape("circle", 0, 0, 200, 100);
    for (const { side, point } of anchorPoints(circle)) {
      // どの点も楕円の上にある
      expect(((point.x - 100) / 100) ** 2 + ((point.y - 50) / 50) ** 2, side).toBeCloseTo(1, 10);
    }
    const topRight = anchorPosition(circle, "topRight");
    expect(topRight.x).toBeCloseTo(100 + 100 * Math.SQRT1_2, 10);
    expect(topRight.y).toBeCloseTo(50 - 50 * Math.SQRT1_2, 10);
  });

  it("角丸矩形の角の接続ポイントは、丸みの真ん中に置く", () => {
    const rounded = shape("rounded", 0, 0, 200, 100);
    const point = anchorPosition(rounded, "bottomLeft");
    const r = ROUNDED_CORNER_RADIUS;
    // 丸みの中心から半径の距離にある
    expect(Math.hypot(point.x - r, point.y - (100 - r))).toBeCloseTo(r, 10);
    expect(point.x).toBeCloseTo(r - r * Math.SQRT1_2, 10);
  });

  it("辺の中点はどの図形でも外接矩形の辺の中点", () => {
    for (const kind of ["rectangle", "rounded", "circle"] as const) {
      expect(anchorPosition(shape(kind, 0, 0, 200, 100), "left")).toEqual({ x: 0, y: 50 });
    }
  });
});

describe("anchorSideNear", () => {
  it("接続ポイントのそばならその辺を返す", () => {
    expect(anchorSideNear(sticky(0, 0), { x: 98, y: 52 }, 1)).toBe("right");
  });

  it("どの接続ポイントからも遠ければ自動 (undefined)", () => {
    expect(anchorSideNear(sticky(0, 0), { x: 50, y: 50 }, 1)).toBeUndefined();
  });

  it("縮小表示では吸い付く距離をワールド座標で広げる", () => {
    const point = { x: 50, y: 25 };
    expect(anchorSideNear(sticky(0, 0), point, 1)).toBeUndefined();
    expect(anchorSideNear(sticky(0, 0), point, 0.5)).toBe("top");
  });

  it("小さいアイテムでは最も近い接続ポイントを選ぶ", () => {
    // 20x20 の付箋では 8 点とも吸い付く範囲に入る
    expect(anchorSideNear(sticky(0, 0, 20), { x: 10, y: 18 }, 1)).toBe("bottom");
    expect(anchorSideNear(sticky(0, 0, 20), { x: 17, y: 18 }, 1)).toBe("bottomRight");
  });

  it("角のそばなら角を返す", () => {
    expect(anchorSideNear(sticky(0, 0), { x: 3, y: -2 }, 1)).toBe("topLeft");
  });
});

describe("pathOfConnector", () => {
  it("コネクタの接続ポイントの設定どおりに経路を求める", () => {
    const path = pathOfConnector(
      createConnector({
        id: "c",
        fromItemId: "a",
        toItemId: "b",
        fromSide: "bottom",
        toSide: "top",
      }),
      sticky(0, 0),
      sticky(300, 0),
    );
    expect(points(path)[0]).toEqual({ x: 50, y: 100 });
    expect(points(path).at(-1)).toEqual({ x: 350, y: 0 });
  });
});

describe("connectorPath: 接続ポイントから出る線は自分の図形を横切らない", () => {
  /** 図形の内側（縁から 1px 以内を除く）にあるか。円と角丸矩形は見た目の輪郭で。 */
  function inside(point: { x: number; y: number }, item: Item): boolean {
    const halfWidth = item.width / 2 - 1;
    const halfHeight = item.height / 2 - 1;
    const dx = Math.abs(point.x - (item.x + item.width / 2));
    const dy = Math.abs(point.y - (item.y + item.height / 2));
    if (dx >= halfWidth || dy >= halfHeight) {
      return false;
    }
    if (item.type === "shape" && item.shape === "circle") {
      return (dx / halfWidth) ** 2 + (dy / halfHeight) ** 2 < 1;
    }
    if (item.type === "shape" && item.shape === "rounded") {
      const r = ROUNDED_CORNER_RADIUS;
      const cornerX = dx - (halfWidth - r);
      const cornerY = dy - (halfHeight - r);
      return cornerX <= 0 || cornerY <= 0 || Math.hypot(cornerX, cornerY) < r;
    }
    return true;
  }

  /** 経路を細かく区切った点。直線・折れ線は区間ごとに、曲線は媒介変数で。 */
  function samplesOf(path: ConnectorPath): { x: number; y: number }[] {
    const result: { x: number; y: number }[] = [];
    if (path.kind === "curve") {
      for (let index = 1; index < 64; index += 1) {
        const t = index / 64;
        const u = 1 - t;
        result.push({
          x:
            u * u * u * path.from.x +
            3 * u * u * t * path.control1.x +
            3 * u * t * t * path.control2.x +
            t * t * t * path.to.x,
          y:
            u * u * u * path.from.y +
            3 * u * u * t * path.control1.y +
            3 * u * t * t * path.control2.y +
            t * t * t * path.to.y,
        });
      }
      return result;
    }
    path.points.forEach((point, index) => {
      const next = path.points[index + 1];
      if (next === undefined) {
        return;
      }
      for (let step = 1; step < 32; step += 1) {
        const t = step / 32;
        result.push({
          x: point.x + (next.x - point.x) * t,
          y: point.y + (next.y - point.y) * t,
        });
      }
    });
    return result;
  }

  /** 線を出す側の図形。付箋と、輪郭が外接矩形と異なる円・角丸矩形。 */
  const owners = [
    sticky(400, 300, 160),
    shape("circle", 400, 300, 200, 160),
    shape("rounded", 400, 300, 160, 160),
  ];
  /** 相手の付箋を置く位置（8 方向）。 */
  const targets = [
    [800, 340],
    [800, 0],
    [400, -300],
    [0, -300],
    [0, 340],
    [0, 700],
    [400, 700],
    [800, 700],
  ] as const;

  for (const kind of ["straight", "curved", "polyline"] as const) {
    for (const own of owners) {
      const name = own.type === "shape" ? own.shape : own.type;
      it(`${kind} (${name}): 両端を指定しても、どちらの図形の内側も通らない`, () => {
        for (const [x, y] of targets) {
          const other =
            own.type === "shape" ? shape(own.shape, x, y, 120, 120) : sticky(x, y, 120);
          for (const from of ANCHOR_SIDES) {
            for (const to of ANCHOR_SIDES) {
              const path = connectorPath(kind, own, other, 0.5, { from, to });
              const crossing = samplesOf(path).find(
                (point) => inside(point, own) || inside(point, other),
              );
              expect(
                crossing,
                `${from} → ${to} (${x}, ${y}) で内側を通る: ${JSON.stringify(crossing)}`,
              ).toBeUndefined();
            }
          }
        }
      });

      it(`${kind} (${name}): どの接続ポイントから出る線も、どの方向の相手へも自分の内側を通らない`, () => {
        for (const side of ANCHOR_SIDES) {
          for (const [x, y] of targets) {
            const other = sticky(x, y, 120);
            const path = connectorPath(kind, own, other, 0.5, { from: side });
            const crossing = samplesOf(path).find((point) => inside(point, own));
            expect(
              crossing,
              `${side} → (${x}, ${y}) で内側を通る: ${JSON.stringify(crossing)}`,
            ).toBeUndefined();
          }
        }
      });
    }
  }
});

describe("connectorPath: 図形が重なって接続ポイントがふさがれているとき", () => {
  it("辺から垂直に出て、そのまま結ぶ", () => {
    const own = sticky(0, 0);
    // 右の辺の先を、大きな図形がすっぽり覆っている
    const cover = createStickyNote({
      id: "cover",
      x: 90,
      y: -200,
      width: 400,
      height: 600,
    });
    const path = connectorPath("polyline", own, cover, 0.5, {
      from: "right",
      to: "left",
    });
    expect(points(path)).toEqual([
      { x: 100, y: 50 },
      { x: 100 + ROUTE_STUB, y: 50 },
      { x: 90 - ROUTE_STUB, y: 100 },
      { x: 90, y: 100 },
    ]);
  });
});
