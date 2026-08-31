/**
 * コネクタの当たり判定。
 *
 * 線は細いので、点との距離が一定以内なら当たったとみなす。
 * 曲線もベジェを細かく分割した折れ線として同じ計算で扱う。
 */

import { bendSegment, connectorEnds, connectorPath } from "./connectorPath";
import type { Board, Connector, ConnectorId, Item } from "./board";
import type { Point } from "./geometry";

/** 線を掴めるとみなす画面上の距離 (px)。 */
export const CONNECTOR_HIT_TOLERANCE = 8;

/**
 * 端点ハンドルの直径 (画面 px)。
 * アイテムの縁に重なるため、アイテム本体と間違えずに掴める大きさが要る。
 */
export const CONNECTOR_HANDLE_SIZE = 12;

/** 端点を掴めるとみなす画面上の半径 (px)。見た目より広めに取る。 */
export const CONNECTOR_HANDLE_HIT_RADIUS = 12;

/** 曲線を折れ線に近似するときの分割数。 */
const CURVE_SEGMENTS = 24;

/** 線分と点の距離。 */
export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }
  // 線分上で最も近い位置を 0〜1 の媒介変数として求める
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared),
  );
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
}

/** 3 次ベジェ曲線上の点。 */
function bezierPoint(
  from: Point,
  control1: Point,
  control2: Point,
  to: Point,
  t: number,
): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * from.x + b * control1.x + c * control2.x + d * to.x,
    y: a * from.y + b * control1.y + c * control2.y + d * to.y,
  };
}

/** コネクタの経路を折れ線の点列に均す。 */
export function connectorPolyline(
  connector: Connector,
  fromItem: Item,
  toItem: Item,
): readonly Point[] {
  const path = connectorPath(connector.kind, fromItem, toItem, connector.bend);
  if (path.kind === "polyline") {
    return path.points;
  }
  return Array.from({ length: CURVE_SEGMENTS + 1 }, (_unused, index) =>
    bezierPoint(
      path.from,
      path.control1,
      path.control2,
      path.to,
      index / CURVE_SEGMENTS,
    ),
  );
}

/**
 * 点に当たるコネクタを返す。
 *
 * @param scale 表示倍率。掴める距離は画面上で一定にしたいので換算する
 */
export function hitTestConnector(
  board: Board,
  point: Point,
  scale: number,
): Connector | undefined {
  const tolerance = CONNECTOR_HIT_TOLERANCE / scale;
  const byId = new Map(board.items.map((item) => [item.id, item]));

  // 後から引いたものが前面にあるとみなし、末尾から探す
  for (const connector of [...board.connectors].reverse()) {
    const fromItem = byId.get(connector.fromItemId);
    const toItem = byId.get(connector.toItemId);
    if (fromItem === undefined || toItem === undefined) {
      continue;
    }
    if (
      isNearPolyline(
        point,
        connectorPolyline(connector, fromItem, toItem),
        tolerance,
      )
    ) {
      return connector;
    }
  }
  return undefined;
}

/** 折れ線のいずれかの区間が点の近くを通るか。 */
function isNearPolyline(
  point: Point,
  points: readonly Point[],
  tolerance: number,
): boolean {
  let previous: Point | undefined;
  for (const current of points) {
    if (
      previous !== undefined &&
      distanceToSegment(point, previous, current) <= tolerance
    ) {
      return true;
    }
    previous = current;
  }
  return false;
}

/** 掴んだ端点。 */
export interface GrabbedConnectorEnd {
  readonly id: ConnectorId;
  readonly end: "from" | "to";
}

/**
 * 指定したコネクタの端点を掴んだかを判定する。
 *
 * @param scale 表示倍率。掴める範囲は画面上で一定にしたいので換算する
 */
export function hitTestConnectorEnd(
  board: Board,
  connectorId: ConnectorId | undefined,
  point: Point,
  scale: number,
): GrabbedConnectorEnd | null {
  if (connectorId === undefined) {
    return null;
  }
  const connector = board.connectors.find(
    (candidate) => candidate.id === connectorId,
  );
  if (connector === undefined) {
    return null;
  }
  const byId = new Map(board.items.map((item) => [item.id, item]));
  const fromItem = byId.get(connector.fromItemId);
  const toItem = byId.get(connector.toItemId);
  if (fromItem === undefined || toItem === undefined) {
    return null;
  }

  const reach = CONNECTOR_HANDLE_HIT_RADIUS / scale;
  const path = connectorPath(connector.kind, fromItem, toItem, connector.bend);
  for (const { end, point: endPoint } of connectorEnds(path)) {
    if (Math.hypot(point.x - endPoint.x, point.y - endPoint.y) <= reach) {
      return { id: connector.id, end };
    }
  }
  return null;
}

/** 掴んだ折れ線の中間の線。 */
export interface GrabbedConnectorBend {
  readonly id: ConnectorId;
  /** 中間の線が縦向き（左右に動かせる）か。カーソルの見た目に使う。 */
  readonly verticalSegment: boolean;
}

/**
 * 指定した折れ線コネクタの中間の線を掴んだかを判定する。
 *
 * 中間の線をドラッグすると折れる位置を変えられる。中間の線を持つのは
 * 折れ線だけなので、直線・曲線は経路を求めた時点で対象外になる。
 * @param scale 表示倍率。掴める距離は画面上で一定にしたいので換算する
 */
export function hitTestConnectorBend(
  board: Board,
  connectorId: ConnectorId | undefined,
  point: Point,
  scale: number,
): GrabbedConnectorBend | null {
  if (connectorId === undefined) {
    return null;
  }
  const connector = board.connectors.find(
    (candidate) => candidate.id === connectorId,
  );
  if (connector === undefined) {
    return null;
  }
  const byId = new Map(board.items.map((item) => [item.id, item]));
  const fromItem = byId.get(connector.fromItemId);
  const toItem = byId.get(connector.toItemId);
  if (fromItem === undefined || toItem === undefined) {
    return null;
  }

  const path = connectorPath(connector.kind, fromItem, toItem, connector.bend);
  const segment = bendSegment(path);
  if (segment === null) {
    return null;
  }
  const tolerance = CONNECTOR_HIT_TOLERANCE / scale;
  if (distanceToSegment(point, segment.a, segment.b) > tolerance) {
    return null;
  }
  return { id: connector.id, verticalSegment: segment.a.x === segment.b.x };
}
