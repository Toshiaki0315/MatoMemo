import { describe, expect, it } from "vitest";
import type { ConnectorPath } from "../domain/connectorPath";
import { createMockContext } from "../test/mockCanvas";
import {
  CONNECTOR_COLOR,
  connectorEnds,
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
    drawConnector(mock.ctx, straight, 1, { arrow: true });
    expect(mock.callsOf("closePath")).toHaveLength(1);
    expect(mock.callsOf("fill")).toHaveLength(1);
    // 三角形なので moveTo 1 回と lineTo 2 回が加わる
    expect(mock.callsOf("lineTo").length).toBeGreaterThanOrEqual(3);
  });

  it("矢印は線と同じ色で塗る", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, straight, 1, { arrow: true, selected: true });
    expect(mock.ctx.fillStyle).toBe(SELECTION_COLOR);
  });

  it("曲線にも矢印を描ける", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, curve, 1, { arrow: true });
    expect(mock.callsOf("closePath")).toHaveLength(1);
  });

  it("向きが決まらない経路では矢印を描かない", () => {
    const mock = createMockContext();
    drawConnector(mock.ctx, { kind: "polyline", points: [] }, 1, {
      arrow: true,
    });
    expect(mock.callsOf("closePath")).toHaveLength(0);
  });
});

describe("connectorEnds", () => {
  it("折れ線の両端を返す", () => {
    expect(connectorEnds(elbow)).toEqual([
      { end: "from", point: { x: 0, y: 0 } },
      { end: "to", point: { x: 100, y: 100 } },
    ]);
  });

  it("曲線の両端を返す", () => {
    expect(connectorEnds(curve)).toEqual([
      { end: "from", point: { x: 0, y: 0 } },
      { end: "to", point: { x: 100, y: 100 } },
    ]);
  });

  it("点が無ければ空を返す", () => {
    expect(connectorEnds({ kind: "polyline", points: [] })).toEqual([]);
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

  it("拡大率に反比例した大きさにする", () => {
    const mock = createMockContext();
    drawConnectorHandles(mock.ctx, straight, 4);
    expect(mock.callsOf("arc")[0]?.args[2]).toBe(1);
  });

  it("点が無ければ何も描かない", () => {
    const mock = createMockContext();
    drawConnectorHandles(mock.ctx, { kind: "polyline", points: [] }, 1);
    expect(mock.callsOf("arc")).toHaveLength(0);
  });
});
