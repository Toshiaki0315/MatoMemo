import { describe, expect, it } from "vitest";
import type { ConnectorPath } from "../domain/connectorPath";
import { CONNECTOR_HANDLE_SIZE } from "../domain/connectorHitTest";
import { createMockContext } from "../test/mockCanvas";
import {
  CONNECTOR_COLOR,
  drawConnector,
  drawConnectorHandles,
} from "./connectorRenderer";
import { SELECTION_COLOR } from "./palette";

const straight: ConnectorPath = {
  kind: "polyline",
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ],
};

const elbow: ConnectorPath = {
  kind: "polyline",
  points: [
    { x: 0, y: 0 },
    { x: 50, y: 0 },
    { x: 50, y: 100 },
    { x: 100, y: 100 },
  ],
};

const curve: ConnectorPath = {
  kind: "curve",
  from: { x: 0, y: 0 },
  control1: { x: 40, y: 0 },
  control2: { x: 60, y: 100 },
  to: { x: 100, y: 100 },
};

describe("drawConnector: 直線", () => {
  it("2 点を直線で結ぶ", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, straight, 1);
    expect(mock.callsOf("moveTo")[0]?.args).toEqual([0, 0]);
    expect(mock.callsOf("lineTo")[0]?.args).toEqual([100, 0]);
    expect(mock.callsOf("stroke")).toHaveLength(1);
  });

  it("既定の色で描く", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, straight, 1);
    expect(mock.ctx.strokeStyle).toBe(CONNECTOR_COLOR);
  });

  it("選択中は選択色で描く", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, straight, 1, { selected: true });
    expect(mock.ctx.strokeStyle).toBe(SELECTION_COLOR);
  });

  it("拡大率に反比例した線幅にして見た目の太さを保つ", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, straight, 4);
    expect(mock.ctx.lineWidth).toBe(0.5);
  });

  it("点が無ければ何も引かない", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, { kind: "polyline", points: [] }, 1);
    expect(mock.callsOf("moveTo")).toHaveLength(0);
    expect(mock.callsOf("lineTo")).toHaveLength(0);
  });
});

describe("drawConnector: 折れ線", () => {
  it("角を丸めて引く", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, elbow, 1);
    expect(mock.callsOf("moveTo")[0]?.args).toEqual([0, 0]);
    // 中間の 2 点は arcTo で丸められ、最後の点だけ lineTo になる
    expect(mock.callsOf("arcTo")).toHaveLength(2);
    expect(mock.callsOf("lineTo")[0]?.args).toEqual([100, 100]);
  });

  it("短い区間では角の半径を小さくする", () => {
    const mock = createMockContext();
    drawConnector(
      mock.ctx,
      {
        kind: "polyline",
        points: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 100 },
        ],
      },
      1,
    );
    // 手前の区間が 4 なので半径は 2 に抑えられる
    expect(mock.callsOf("arcTo")[0]?.args[4]).toBe(2);
  });
});

describe("drawConnector: 曲線", () => {
  it("3 次ベジェで引く", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, curve, 1);
    expect(mock.callsOf("moveTo")[0]?.args).toEqual([0, 0]);
    expect(mock.callsOf("bezierCurveTo")[0]?.args).toEqual([
      40, 0, 60, 100, 100, 100,
    ]);
  });
});

describe("drawConnector: 矢印", () => {
  it("既定では矢印を描かない", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, straight, 1);
    expect(mock.callsOf("closePath")).toHaveLength(0);
    expect(mock.callsOf("fill")).toHaveLength(0);
  });

  it("指定すると終点に三角形を描く", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, straight, 1, { endCap: "arrow" });
    expect(mock.callsOf("closePath")).toHaveLength(1);
    expect(mock.callsOf("fill")).toHaveLength(1);
    // 三角形なので moveTo 1 回と lineTo 2 回が加わる
    expect(mock.callsOf("lineTo").length).toBeGreaterThanOrEqual(3);
  });

  it("矢印は線と同じ色で塗る", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, straight, 1, { endCap: "arrow", selected: true });
    expect(mock.ctx.fillStyle).toBe(SELECTION_COLOR);
  });

  it("曲線にも矢印を描ける", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, curve, 1, { endCap: "arrow" });
    expect(mock.callsOf("closePath")).toHaveLength(1);
  });

  it("向きが決まらない経路では矢印を描かない", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, { kind: "polyline", points: [] }, 1, {
      endCap: "arrow",
    });
    expect(mock.callsOf("closePath")).toHaveLength(0);
  });
});

describe("drawConnectorHandles", () => {
  it("両端に円を描く", () => {
    const mock = createMockContext();
    drawConnectorHandles(mock.ctx, straight, 1);
    const arcs = mock.callsOf("arc").map((call) => call.args.slice(0, 2));
    expect(arcs).toEqual([
      [0, 0],
      [100, 0],
    ]);
  });

  it("拡大率に反比例した大きさにして見た目を保つ", () => {
    const mock = createMockContext();
    drawConnectorHandles(mock.ctx, straight, 4);
    expect(mock.callsOf("arc")[0]?.args[2]).toBe(CONNECTOR_HANDLE_SIZE / 4 / 2);
  });

  it("点が無ければ何も描かない", () => {
    const mock = createMockContext();
    drawConnectorHandles(mock.ctx, { kind: "polyline", points: [] }, 1);
    expect(mock.callsOf("arc")).toHaveLength(0);
  });
});

describe("drawConnector: 両端の矢印", () => {
  it("始点だけに矢印を描ける", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, straight, 1, { startCap: "arrow" });
    expect(mock.callsOf("closePath")).toHaveLength(1);
    // 始点 (0,0) を頂点にする
    expect(mock.callsOf("moveTo").at(-1)?.args).toEqual([0, 0]);
  });

  it("両端に矢印を描ける", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, straight, 1, { startCap: "arrow", endCap: "arrow" });
    expect(mock.callsOf("closePath")).toHaveLength(2);
  });

  it("始点の矢印は線が入ってくる向きに合わせる", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, straight, 1, { startCap: "arrow" });
    // 左向きの矢印なので、矢羽根は始点より右へ開く
    const lineTo = mock.callsOf("lineTo").slice(-2);
    for (const call of lineTo) {
      expect(call.args[0] as number).toBeGreaterThan(0);
    }
  });

  it("曲線でも始点に矢印を描ける", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, curve, 1, { startCap: "arrow" });
    expect(mock.callsOf("closePath")).toHaveLength(1);
  });
});

describe("drawConnector: 太さに応じた調整", () => {
  /** 指定した太さ・線種で引いたときの破線パターン。 */
  function dashOf(strokeWidth: number) {
    const mock = createMockContext();
    drawConnector(mock.ctx, straight, 1, {
      stroke: { strokeWidth, strokeStyle: "dashed" },
    });
    return mock.callsOf("setLineDash")[0]?.args[0] as number[];
  }

  /** 指定した太さで矢印を描いたときの矢羽根の長さ。 */
  function arrowLengthOf(strokeWidth: number) {
    const mock = createMockContext();
    drawConnector(mock.ctx, straight, 1, {
      endCap: "arrow",
      stroke: { strokeWidth, strokeStyle: "solid" },
    });
    const tip = mock.callsOf("moveTo").at(-1)?.args as number[];
    const left = mock.callsOf("lineTo").at(-2)?.args as number[];
    return Math.hypot(
      (left[0] as number) - (tip[0] as number),
      (left[1] as number) - (tip[1] as number),
    );
  }

  it("太い線ほど破線の間隔を広く取る", () => {
    expect(dashOf(8)[0] as number).toBeGreaterThan(dashOf(2)[0] as number);
  });

  it("太い線ほど矢印を大きくする", () => {
    expect(arrowLengthOf(8)).toBeGreaterThan(arrowLengthOf(2));
  });

  it("細い線では矢印の大きさを変えない", () => {
    expect(arrowLengthOf(1)).toBeCloseTo(arrowLengthOf(2), 10);
  });

  it("丸も太さに応じて大きくなる", () => {
    function circleRadius(strokeWidth: number) {
      const mock = createMockContext();
      drawConnector(mock.ctx, straight, 1, {
        endCap: "circle",
        stroke: { strokeWidth, strokeStyle: "solid" },
      });
      return mock.callsOf("arc")[0]?.args[2] as number;
    }
    expect(circleRadius(8)).toBeGreaterThan(circleRadius(2));
  });
});

describe("drawConnector: 印の手前で線を止める", () => {
  /** 引いた線の終点（折れ線の最後の lineTo）。 */
  function strokedEnd(options: Parameters<typeof drawConnector>[3]) {
    const mock = createMockContext();
    drawConnector(mock.ctx, straight, 1, options);
    // 矢印の三角形より前に引かれた線の終点を見る
    const stroke = mock.calls.findIndex((call) => call.method === "stroke");
    const lineTo = mock.calls
      .slice(0, stroke)
      .filter((call) => call.method === "lineTo");
    return lineTo.at(-1)?.args as number[];
  }

  it("印が無ければ端まで線を引く", () => {
    expect(strokedEnd({})?.[0]).toBe(100);
  });

  it("矢印があれば付け根まででとどめる", () => {
    const end = strokedEnd({ endCap: "arrow" })?.[0] as number;
    expect(end).toBeLessThan(100);
    expect(end).toBeGreaterThan(0);
  });

  it("丸があれば中心の手前でとどめる", () => {
    const end = strokedEnd({ endCap: "circle" })?.[0] as number;
    expect(end).toBeLessThan(100);
  });

  it("太い線ほど手前で止める（印が大きくなるため）", () => {
    const thin = strokedEnd({
      endCap: "arrow",
      stroke: { strokeWidth: 1, strokeStyle: "solid" },
    })?.[0] as number;
    const thick = strokedEnd({
      endCap: "arrow",
      stroke: { strokeWidth: 8, strokeStyle: "solid" },
    })?.[0] as number;
    expect(thick).toBeLessThan(thin);
  });

  it("始点側の印でも同じように止める", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, straight, 1, { startCap: "arrow" });
    const stroke = mock.calls.findIndex((call) => call.method === "stroke");
    const moveTo = mock.calls
      .slice(0, stroke)
      .filter((call) => call.method === "moveTo");
    expect(moveTo[0]?.args[0] as number).toBeGreaterThan(0);
  });

  it("印そのものは元の端に描く", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, straight, 1, { endCap: "arrow" });
    // 三角形の頂点は元の終点のまま
    expect(mock.callsOf("moveTo").at(-1)?.args).toEqual([100, 0]);
  });

  it("曲線でも印の手前で止める", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, curve, 1, { endCap: "arrow" });
    const bezier = mock.callsOf("bezierCurveTo")[0]?.args as number[];
    // 終点 (100, 100) より手前で終わる
    expect(bezier[4] as number).toBeLessThan(100);
  });

  it("曲線でも印は元の端に描く", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, curve, 1, { endCap: "circle" });
    expect(mock.callsOf("arc")[0]?.args.slice(0, 2)).toEqual([100, 100]);
  });
});
