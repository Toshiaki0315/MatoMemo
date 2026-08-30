import { describe, expect, it } from "vitest";
import { createBoard, createConnector, createStickyNote } from "./board";
import { addConnector, addItem } from "./boardOps";
import {
  CONNECTOR_HIT_TOLERANCE,
  connectorPolyline,
  distanceToSegment,
  hitTestConnector,
} from "./connectorHitTest";
import type { ConnectorKind } from "./board";

/** 左右に離れた付箋 2 枚を 1 本のコネクタで結んだボード。 */
function boardWithConnector(kind: ConnectorKind = "straight") {
  let board = createBoard({ id: "b" });
  board = addItem(
    board,
    createStickyNote({ id: "a", x: 0, y: 0, width: 100, height: 100 }),
  );
  board = addItem(
    board,
    createStickyNote({ id: "b", x: 300, y: 0, width: 100, height: 100 }),
  );
  return addConnector(
    board,
    createConnector({ id: "c1", fromItemId: "a", toItemId: "b", kind }),
  );
}

describe("distanceToSegment", () => {
  const a = { x: 0, y: 0 };
  const b = { x: 100, y: 0 };

  it("線分上の点は距離 0", () => {
    expect(distanceToSegment({ x: 50, y: 0 }, a, b)).toBe(0);
  });

  it("垂線の距離を返す", () => {
    expect(distanceToSegment({ x: 50, y: 20 }, a, b)).toBe(20);
  });

  it("端より外側では端点までの距離になる", () => {
    expect(distanceToSegment({ x: -30, y: 0 }, a, b)).toBe(30);
    expect(distanceToSegment({ x: 130, y: 0 }, a, b)).toBe(30);
  });

  it("長さ 0 の線分では端点までの距離になる", () => {
    expect(distanceToSegment({ x: 3, y: 4 }, a, a)).toBe(5);
  });
});

describe("connectorPolyline", () => {
  it("直線は 2 点のまま返す", () => {
    const board = boardWithConnector("straight");
    const points = connectorPolyline(
      board.connectors[0]!,
      board.items[0]!,
      board.items[1]!,
    );
    expect(points).toHaveLength(2);
  });

  it("曲線は折れ線に近似する", () => {
    const board = boardWithConnector("curved");
    const points = connectorPolyline(
      board.connectors[0]!,
      board.items[0]!,
      board.items[1]!,
    );
    expect(points.length).toBeGreaterThan(2);
    expect(points[0]).toEqual({ x: 100, y: 50 });
    expect(points.at(-1)).toEqual({ x: 300, y: 50 });
  });
});

describe("hitTestConnector", () => {
  it("線の上の点で当たる", () => {
    expect(
      hitTestConnector(boardWithConnector(), { x: 200, y: 50 }, 1)?.id,
    ).toBe("c1");
  });

  it("少し離れていても許容範囲なら当たる", () => {
    expect(
      hitTestConnector(
        boardWithConnector(),
        { x: 200, y: 50 + CONNECTOR_HIT_TOLERANCE - 1 },
        1,
      )?.id,
    ).toBe("c1");
  });

  it("許容範囲を超えると当たらない", () => {
    expect(
      hitTestConnector(boardWithConnector(), { x: 200, y: 100 }, 1),
    ).toBeUndefined();
  });

  it("拡大時は掴める距離がワールド座標では狭くなる", () => {
    const board = boardWithConnector();
    const point = { x: 200, y: 54 };
    expect(hitTestConnector(board, point, 1)?.id).toBe("c1");
    expect(hitTestConnector(board, point, 4)).toBeUndefined();
  });

  it("曲線にも当たる", () => {
    const board = boardWithConnector("curved");
    // 横並びの曲線は両端の高さを通る
    expect(hitTestConnector(board, { x: 100, y: 50 }, 1)?.id).toBe("c1");
  });

  it("折れ線にも当たる", () => {
    const board = boardWithConnector("polyline");
    expect(hitTestConnector(board, { x: 200, y: 50 }, 1)?.id).toBe("c1");
  });

  it("コネクタが無ければ undefined", () => {
    expect(
      hitTestConnector(createBoard({ id: "b" }), { x: 0, y: 0 }, 1),
    ).toBeUndefined();
  });

  it("接続先が失われたコネクタは無視する", () => {
    let board = createBoard({ id: "b" });
    board = addItem(
      board,
      createStickyNote({ id: "a", x: 0, y: 0, width: 100, height: 100 }),
    );
    board = addConnector(
      board,
      createConnector({ id: "c1", fromItemId: "a", toItemId: "missing" }),
    );
    expect(hitTestConnector(board, { x: 50, y: 50 }, 1)).toBeUndefined();
  });

  it("重なる場合は後から引いたものを返す", () => {
    let board = boardWithConnector();
    board = addConnector(
      board,
      createConnector({ id: "c2", fromItemId: "a", toItemId: "b" }),
    );
    expect(hitTestConnector(board, { x: 200, y: 50 }, 1)?.id).toBe("c2");
  });
});
