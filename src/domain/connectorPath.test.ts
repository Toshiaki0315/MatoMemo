import { describe, expect, it } from "vitest";
import { createShape, createStickyNote, type Item } from "./board";
import {
  CAP_LENGTHS,
  arrowDepth,
  arrowHead,
  bendForPoint,
  bendSegment,
  capLength,
  trimPath,
  connectorEnds,
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
