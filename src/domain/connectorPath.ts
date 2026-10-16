/**
 * コネクタの経路計算。
 *
 * 経路はアイテムの現在位置から毎回求める。コネクタ自体に座標を持たせると
 * アイテムを動かすたびに更新が必要になり、取りこぼすと線が取り残される。
 * 「常に今の位置から計算する」ことで、追従の実装そのものが不要になる。
 */

import {
  ANCHOR_SIDES,
  clampBend,
  DEFAULT_BEND,
  isCornerAnchor,
  ROUNDED_CORNER_RADIUS,
} from "./board";
import type {
  AnchorSide,
  CapSize,
  Connector,
  ConnectorKind,
  Item,
} from "./board";
import {
  ROUTE_STUB,
  routeAround,
  straightenRoute,
} from "./connectorRoute";
import { rectCenter, type Point, type Rect } from "./geometry";

export { ROUTE_STUB };

/** アイテムの輪郭の種類。円だけが楕円、それ以外は矩形として扱う。 */
export type Outline = "rectangle" | "ellipse";

/** 接続ポイントの位置（上下左右の辺と、4 つの角）。 */
export type Side = AnchorSide;

/**
 * 両端の接続ポイントの指定。省略した端は自動。
 * コネクタの項目をそのまま渡せるよう、undefined も受け付ける。
 */
export interface ConnectorSides {
  readonly from?: Side | undefined;
  readonly to?: Side | undefined;
}

/** 描画に必要な経路の情報。 */
export type ConnectorPath =
  | {
      readonly kind: "polyline";
      readonly points: readonly Point[];
      /**
       * 中間の線をドラッグして折れる位置を変えられるか。
       * 接続ポイントを指定した折れ線は辺に合わせて経路を組むので、
       * 折れる位置の割合は使わない（false）。省略時は変えられる。
       */
      readonly adjustable?: boolean;
      /** 角の丸み（ワールド px）。省略時は描画の既定。 */
      readonly cornerRadius?: number;
    }
  | {
      readonly kind: "curve";
      readonly from: Point;
      readonly control1: Point;
      readonly control2: Point;
      readonly to: Point;
    };

/** 曲線の制御点が最低限張り出す長さ。近接時でも曲線らしさを保つため。 */
const MIN_CURVE_BULGE = 40;

/** 制御点の張り出しを距離に対してどれだけ取るか。 */
const CURVE_BULGE_RATIO = 0.4;

/** アイテムの輪郭の種類を返す。 */
export function outlineOf(item: Item): Outline {
  return item.type === "shape" && item.shape === "circle"
    ? "ellipse"
    : "rectangle";
}

/** アイテムの外接矩形。 */
function boundsOf(item: Item): Rect {
  return { x: item.x, y: item.y, width: item.width, height: item.height };
}

/**
 * 中心から `towards` へ向かう半直線が輪郭と交わる点を返す。
 * 線をアイテムの内側まで引かず、境界で止めるために使う。
 */
export function boundaryAnchor(
  bounds: Rect,
  towards: Point,
  outline: Outline,
): Point {
  const center = rectCenter(bounds);
  const dx = towards.x - center.x;
  const dy = towards.y - center.y;
  if (dx === 0 && dy === 0) {
    return center;
  }

  const halfWidth = bounds.width / 2;
  const halfHeight = bounds.height / 2;
  if (halfWidth === 0 || halfHeight === 0) {
    return center;
  }

  const scale =
    outline === "ellipse"
      ? 1 / Math.hypot(dx / halfWidth, dy / halfHeight)
      : // 矩形では、先に辺に達するほうの軸で止める
        Math.min(
          dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx),
          dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy),
        );

  return { x: center.x + dx * scale, y: center.y + dy * scale };
}

/**
 * 接続ポイントの、中心から見た向き。辺は軸の向き、角は斜め。
 * 角の値は単位ベクトルではなく、各成分が ±1。
 */
const SIDE_DIRECTIONS: Record<Side, Point> = {
  top: { x: 0, y: -1 },
  topRight: { x: 1, y: -1 },
  right: { x: 1, y: 0 },
  bottomRight: { x: 1, y: 1 },
  bottom: { x: 0, y: 1 },
  bottomLeft: { x: -1, y: 1 },
  left: { x: -1, y: 0 },
  topLeft: { x: -1, y: -1 },
};

/**
 * 外接矩形の上の接続ポイント。辺は中点、角は頂点。
 * 辺の中点は円の場合も楕円上にある。
 */
export function sideAnchor(bounds: Rect, side: Side): Point {
  const center = rectCenter(bounds);
  const direction = SIDE_DIRECTIONS[side];
  return {
    x: center.x + (direction.x * bounds.width) / 2,
    y: center.y + (direction.y * bounds.height) / 2,
  };
}

/** 角丸矩形の角の丸み。それ以外は 0（付箋の小さな丸みは無視する）。 */
function cornerRadiusOf(item: Item): number {
  return item.type === "shape" && item.shape === "rounded"
    ? Math.min(ROUNDED_CORNER_RADIUS, item.width / 2, item.height / 2)
    : 0;
}

/**
 * アイテムの接続ポイントの位置。
 * 角は輪郭の上に置く。円なら斜め 45° の位置、角丸矩形なら丸みの真ん中。
 * 外接矩形の頂点のままだと、図形から離れた何も無いところに線が付いてしまう。
 */
export function anchorPosition(item: Item, side: Side): Point {
  const bounds = boundsOf(item);
  if (!isCornerAnchor(side)) {
    return sideAnchor(bounds, side);
  }
  const center = rectCenter(bounds);
  const direction = SIDE_DIRECTIONS[side];
  const halfWidth = bounds.width / 2;
  const halfHeight = bounds.height / 2;
  if (outlineOf(item) === "ellipse") {
    return {
      x: center.x + direction.x * halfWidth * Math.SQRT1_2,
      y: center.y + direction.y * halfHeight * Math.SQRT1_2,
    };
  }
  const inset = cornerRadiusOf(item) * (1 - Math.SQRT1_2);
  return {
    x: center.x + direction.x * (halfWidth - inset),
    y: center.y + direction.y * (halfHeight - inset),
  };
}

/**
 * 点がアイテムの輪郭の内側にあるか。輪郭の上や、輪郭から 0.5px 以内は
 * 外とみなす（輪郭の上にある接続ポイントから出る線を「通る」と数えないため）。
 */
function insideOutline(point: Point, item: Item): boolean {
  const center = rectCenter(boundsOf(item));
  const halfWidth = item.width / 2 - OUTLINE_TOLERANCE;
  const halfHeight = item.height / 2 - OUTLINE_TOLERANCE;
  const dx = Math.abs(point.x - center.x);
  const dy = Math.abs(point.y - center.y);
  if (dx >= halfWidth || dy >= halfHeight) {
    return false;
  }
  if (outlineOf(item) === "ellipse") {
    return (dx / halfWidth) ** 2 + (dy / halfHeight) ** 2 < 1;
  }
  // 角丸矩形の角では、丸みの外側を除く
  const radius = cornerRadiusOf(item);
  const cornerX = dx - (halfWidth - radius);
  const cornerY = dy - (halfHeight - radius);
  return cornerX <= 0 || cornerY <= 0 || Math.hypot(cornerX, cornerY) < radius;
}

/** 輪郭の内側かを調べるとき、輪郭の上とみなす幅（ワールド px）。 */
const OUTLINE_TOLERANCE = 0.5;

/**
 * 線や曲線が輪郭の内側を通るかを調べるときの区切りの数。
 * 図形の角をわずかにかすめる程度でも見落とさないよう、細かく取る。
 */
const CROSSING_SAMPLES = 128;

/** 線分がアイテムの輪郭の内側を通るか。細かく区切った点で調べる。 */
function segmentCrossesOutline(a: Point, b: Point, item: Item): boolean {
  for (let index = 1; index < CROSSING_SAMPLES; index += 1) {
    const t = index / CROSSING_SAMPLES;
    if (insideOutline({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, item)) {
      return true;
    }
  }
  return false;
}

/** 2 つのアイテムの位置関係から、どちらの辺で接続するかを決める。 */
function facingSides(
  from: Rect,
  to: Rect,
): { fromSide: Side; toSide: Side; horizontal: boolean } {
  const fromCenter = rectCenter(from);
  const toCenter = rectCenter(to);
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { fromSide: "right", toSide: "left", horizontal: true }
      : { fromSide: "left", toSide: "right", horizontal: true };
  }
  return dy >= 0
    ? { fromSide: "bottom", toSide: "top", horizontal: false }
    : { fromSide: "top", toSide: "bottom", horizontal: false };
}

/**
 * 曲線が接続ポイントから出ていく向き（単位ベクトル）。輪郭に垂直な向き。
 * 円の角は楕円の法線、矩形の角は斜め 45°。
 */
function curveNormal(item: Item, side: Side): Point {
  const direction = SIDE_DIRECTIONS[side];
  const normal =
    outlineOf(item) === "ellipse"
      ? // 楕円の法線は、軸の長さを入れ替えて掛けた向き
        { x: direction.x * item.height, y: direction.y * item.width }
      : direction;
  const length = Math.hypot(normal.x, normal.y);
  return { x: normal.x / length, y: normal.y / length };
}

/**
 * 直交の経路が接続ポイントから出ていく向き。辺はその外向き。
 * 角は横と縦の 2 通りがあるので、`aim`（相手の端）がより先にある側を選ぶ。
 */
function exitDirection(side: Side, anchor: Point, aim: Point): Point {
  const direction = SIDE_DIRECTIONS[side];
  if (!isCornerAnchor(side)) {
    return direction;
  }
  const ahead = {
    x: (aim.x - anchor.x) * direction.x,
    y: (aim.y - anchor.y) * direction.y,
  };
  return ahead.x >= ahead.y ? { x: direction.x, y: 0 } : { x: 0, y: direction.y };
}

/**
 * 接続ポイントから `direction` へまっすぐ出た先の点。外接矩形から
 * `ROUTE_STUB` 離す。円の角のように外接矩形の内側にある接続ポイントでも、
 * 経路の探索は図形の外から始められる。
 */
function leadPoint(bounds: Rect, anchor: Point, direction: Point): Point {
  if (direction.x !== 0) {
    const edge = direction.x > 0 ? bounds.x + bounds.width : bounds.x;
    return { x: edge + direction.x * ROUTE_STUB, y: anchor.y };
  }
  const edge = direction.y > 0 ? bounds.y + bounds.height : bounds.y;
  return { x: anchor.x, y: edge + direction.y * ROUTE_STUB };
}

/** 接続する辺を決める。指定があればそれを、無ければ向かい合う辺を使う。 */
function resolveSides(
  from: Rect,
  to: Rect,
  sides: ConnectorSides,
): { fromSide: Side; toSide: Side } {
  const facing = facingSides(from, to);
  return {
    fromSide: sides.from ?? facing.fromSide,
    toSide: sides.to ?? facing.toSide,
  };
}

/** 接続ポイントを指定した線の、両端の点と、そこから出た先の点。 */
interface AnchoredEnds {
  readonly from: Rect;
  readonly to: Rect;
  readonly start: Point;
  readonly first: Point;
  readonly end: Point;
  readonly last: Point;
}

/** 接続ポイントの位置と、経路の探索を始める（終える）点を決める。自動の端は向かい合う辺。 */
function anchoredEnds(
  fromItem: Item,
  toItem: Item,
  sides: ConnectorSides,
): AnchoredEnds {
  const from = boundsOf(fromItem);
  const to = boundsOf(toItem);
  const { fromSide, toSide } = resolveSides(from, to, sides);
  const start = anchorPosition(fromItem, fromSide);
  const end = anchorPosition(toItem, toSide);
  return {
    from,
    to,
    start,
    first: leadPoint(from, start, exitDirection(fromSide, start, end)),
    end,
    last: leadPoint(to, end, exitDirection(toSide, end, start)),
  };
}

/** 接続ポイントを指定した線の経路。図形を避けて直交する折れ線で結ぶ。 */
function anchoredRoute(ends: AnchoredEnds): Point[] {
  const { from, to, start, first, end, last } = ends;
  // 図形が重なって接続ポイントがふさがれているときは、出た先どうしをそのまま結ぶ
  return routeAround(start, first, end, last, [from, to]) ?? [start, first, last, end];
}

/**
 * 経路の両端に、接続ポイントから出た先の点を入れ直す。
 * 経路は一直線に並ぶ点を省いているので、出た先の点が消えていることがある。
 * 直線の線ではこの点まで垂直に出てから斜めに向かうので、残しておく必要がある。
 */
function withLeads(route: readonly Point[], ends: AnchoredEnds): Point[] {
  const result = [...route];
  if (!samePoint(result[1] as Point, ends.first)) {
    result.splice(1, 0, ends.first);
  }
  if (!samePoint(result.at(-2) as Point, ends.last)) {
    result.splice(-1, 0, ends.last);
  }
  return result;
}

function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * 2 点を直線で結ぶ経路。
 *
 * 接続ポイントを指定したときは、図形を避ける経路を求めたうえで、見通せる
 * ところは斜めにまっすぐつなぐ。辺を指定した端は辺から垂直に出入りする。
 * 中点からそのまま斜めに引くと、相手が反対側にいるとき線が自分の図形の
 * 下を通って隠れ、別の辺から出ているように見えてしまうため。
 */
function straightPath(
  fromItem: Item,
  toItem: Item,
  sides: ConnectorSides,
): ConnectorPath {
  const from = boundsOf(fromItem);
  const to = boundsOf(toItem);
  if (sides.from === undefined && sides.to === undefined) {
    return {
      kind: "polyline",
      points: [
        boundaryAnchor(from, rectCenter(to), outlineOf(fromItem)),
        boundaryAnchor(to, rectCenter(from), outlineOf(toItem)),
      ],
    };
  }
  const ends = anchoredEnds(fromItem, toItem, sides);
  const points =
    directLine(fromItem, toItem, sides) ??
    straightenRoute(
      withLeads(anchoredRoute(ends), ends),
      [from, to],
      keepCount(sides.from),
      keepCount(sides.to),
    );
  // 自動の端は、隣の点へ向かう向きで輪郭と交わる点にする
  const last = points.length - 1;
  if (sides.from === undefined) {
    points[0] = boundaryAnchor(from, points[1] as Point, outlineOf(fromItem));
  }
  if (sides.to === undefined) {
    points[last] = boundaryAnchor(to, points[last - 1] as Point, outlineOf(toItem));
  }
  return {
    kind: "polyline",
    points,
    // 点が増えても折れ線の「中間の線」ではないので、掴ませない
    adjustable: false,
  };
}

/**
 * 経路をまっすぐつなぎ直すとき、端から残す点の数。
 * 辺を指定した端は、辺から垂直に出る部分（2 点）を残す。
 * 角と自動の端は、どの向きへ出てもよいので端の点だけ残す。
 */
function keepCount(side: Side | undefined): number {
  return side !== undefined && !isCornerAnchor(side) ? 2 : 1;
}

/**
 * 角や自動の端どうしを、どちらの図形も横切らずに結べるなら、その 2 点。
 * 辺を指定した端があるときや、図形にふさがれるときは null。
 */
function directLine(
  fromItem: Item,
  toItem: Item,
  sides: ConnectorSides,
): Point[] | null {
  if (keepCount(sides.from) > 1 || keepCount(sides.to) > 1) {
    return null;
  }
  const start =
    sides.from === undefined ? undefined : anchorPosition(fromItem, sides.from);
  const end = sides.to === undefined ? undefined : anchorPosition(toItem, sides.to);
  // 両端とも自動の場合は呼ばれないので、少なくとも一方は角が決まっている
  const a =
    start ?? boundaryAnchor(boundsOf(fromItem), end as Point, outlineOf(fromItem));
  const b = end ?? boundaryAnchor(boundsOf(toItem), a, outlineOf(toItem));
  if (segmentCrossesOutline(a, b, fromItem) || segmentCrossesOutline(a, b, toItem)) {
    return null;
  }
  return [a, b];
}

/**
 * 直交する折れ線で結ぶ経路。
 * 向かい合う辺から出て、中間で一度だけ折れる 3 区間の経路にする。
 * @param bend 中間の線の位置。始点側 0〜終点側 1 の割合
 */
function polylinePath(
  fromItem: Item,
  toItem: Item,
  bend: number,
  sides: ConnectorSides,
): ConnectorPath {
  // 接続ポイントを指定したときは、そこから出入りし、図形を避ける経路にする
  if (sides.from !== undefined || sides.to !== undefined) {
    return {
      kind: "polyline",
      points: anchoredRoute(anchoredEnds(fromItem, toItem, sides)),
      adjustable: false,
    };
  }
  const from = boundsOf(fromItem);
  const to = boundsOf(toItem);
  const { fromSide, toSide, horizontal } = facingSides(from, to);
  const start = sideAnchor(from, fromSide);
  const end = sideAnchor(to, toSide);
  const ratio = clampBend(bend);

  if (horizontal) {
    const middleX = start.x + (end.x - start.x) * ratio;
    return {
      kind: "polyline",
      points: [
        start,
        { x: middleX, y: start.y },
        { x: middleX, y: end.y },
        end,
      ],
    } as const;
  }
  const middleY = start.y + (end.y - start.y) * ratio;
  return {
    kind: "polyline",
    points: [start, { x: start.x, y: middleY }, { x: end.x, y: middleY }, end],
  } as const;
}

/** 折れ線の中間の線の両端。 */
export interface BendSegment {
  readonly a: Point;
  readonly b: Point;
}

/**
 * 折れ線の中間の線（折れる位置を決めている線）を返す。
 *
 * 折れ線の経路は 4 点で、そのうち内側の 2 点がこの線にあたる。
 * 曲線や、折れの無い直線（2 点）には中間の線が無いので null を返す。
 */
export function bendSegment(path: ConnectorPath): BendSegment | null {
  if (path.kind !== "polyline" || path.adjustable === false) {
    return null;
  }
  const [a, b] = path.points.slice(1, 3);
  if (a === undefined || b === undefined) {
    return null;
  }
  return { a, b };
}

/**
 * ドラッグ先の点から、中間の線の位置（割合）を求める。
 *
 * 中間の線は、横並びなら左右、縦並びなら上下にだけ動かせる。
 * 2 つのアイテムの端が同じ位置にあり按分が決められない場合は null。
 */
export function bendForPoint(
  fromItem: Item,
  toItem: Item,
  point: Point,
): number | null {
  const from = boundsOf(fromItem);
  const to = boundsOf(toItem);
  const { fromSide, toSide, horizontal } = facingSides(from, to);
  const start = sideAnchor(from, fromSide);
  const end = sideAnchor(to, toSide);

  const span = horizontal ? end.x - start.x : end.y - start.y;
  if (span === 0) {
    return null;
  }
  const value = horizontal
    ? (point.x - start.x) / span
    : (point.y - start.y) / span;
  return clampBend(value);
}

/**
 * 3 次ベジェ曲線で結ぶ経路。
 * 制御点を接続ポイントで輪郭に垂直な向きに張り出させ、輪郭から垂直に
 * 出ていくようにする。
 */
function curvedPath(
  fromItem: Item,
  toItem: Item,
  sides: ConnectorSides,
): ConnectorPath {
  const { fromSide, toSide } = resolveSides(
    boundsOf(fromItem),
    boundsOf(toItem),
    sides,
  );
  const start = anchorPosition(fromItem, fromSide);
  const end = anchorPosition(toItem, toSide);

  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const bulge = Math.max(MIN_CURVE_BULGE, distance * CURVE_BULGE_RATIO);
  const out = curveNormal(fromItem, fromSide);
  const into = curveNormal(toItem, toSide);

  const path = {
    kind: "curve" as const,
    from: start,
    control1: { x: start.x + out.x * bulge, y: start.y + out.y * bulge },
    control2: { x: end.x + into.x * bulge, y: end.y + into.y * bulge },
    to: end,
  };
  // 接続ポイントが相手と反対を向いていると、曲線が図形の下を通って
  // 隠れる。そのときは図形を避ける経路を、角を大きく丸めて描く
  if (
    (sides.from !== undefined || sides.to !== undefined) &&
    (curveCrosses(path, fromItem) || curveCrosses(path, toItem))
  ) {
    return {
      kind: "polyline",
      points: anchoredRoute(anchoredEnds(fromItem, toItem, sides)),
      adjustable: false,
      cornerRadius: CURVED_ROUTE_RADIUS,
    };
  }
  return path;
}

/** 曲線の代わりに回り込む経路を描くときの、角の丸み（ワールド px）。 */
const CURVED_ROUTE_RADIUS = 48;

/** 曲線を細かく区切った点のいずれかがアイテムの輪郭の内側にあるか。 */
function curveCrosses(
  path: Extract<ConnectorPath, { kind: "curve" }>,
  item: Item,
): boolean {
  for (let index = 1; index < CROSSING_SAMPLES; index += 1) {
    const t = index / CROSSING_SAMPLES;
    const u = 1 - t;
    const x =
      u * u * u * path.from.x +
      3 * u * u * t * path.control1.x +
      3 * u * t * t * path.control2.x +
      t * t * t * path.to.x;
    const y =
      u * u * u * path.from.y +
      3 * u * u * t * path.control1.y +
      3 * u * t * t * path.control2.y +
      t * t * t * path.to.y;
    if (insideOutline({ x, y }, item)) {
      return true;
    }
  }
  return false;
}

/** アイテムの接続ポイント（上下左右の辺の中点と、4 つの角）。 */
export function anchorPoints(
  item: Item,
): readonly { readonly side: Side; readonly point: Point }[] {
  return ANCHOR_SIDES.map((side) => ({ side, point: anchorPosition(item, side) }));
}

/** 接続ポイントに吸い付く距離（画面 px）。 */
export const ANCHOR_SNAP_DISTANCE = 16;

/**
 * 点のそばにある接続ポイントの辺を返す。どれも遠ければ undefined（自動）。
 * @param scale 表示倍率。吸い付く距離は画面上で一定にしたいので換算する
 */
export function anchorSideNear(
  item: Item,
  point: Point,
  scale: number,
): Side | undefined {
  const reach = ANCHOR_SNAP_DISTANCE / scale;
  let nearest: Side | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const anchor of anchorPoints(item)) {
    const distance = Math.hypot(
      point.x - anchor.point.x,
      point.y - anchor.point.y,
    );
    if (distance <= reach && distance < nearestDistance) {
      nearest = anchor.side;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/**
 * コネクタの経路を、接続先アイテムの現在位置から求める。
 * @param bend 折れ線の中間の線の位置。折れ線以外では使わない
 * @param sides 両端の接続ポイント。省略した端は自動
 */
export function connectorPath(
  kind: ConnectorKind,
  fromItem: Item,
  toItem: Item,
  bend: number = DEFAULT_BEND,
  sides: ConnectorSides = {},
): ConnectorPath {
  switch (kind) {
    case "polyline":
      return polylinePath(fromItem, toItem, bend, sides);
    case "curved":
      return curvedPath(fromItem, toItem, sides);
    default:
      return straightPath(fromItem, toItem, sides);
  }
}

/** コネクタの設定（種類・折れ位置・接続ポイント）どおりの経路を求める。 */
export function pathOfConnector(
  connector: Connector,
  fromItem: Item,
  toItem: Item,
): ConnectorPath {
  return connectorPath(connector.kind, fromItem, toItem, connector.bend, {
    from: connector.fromSide,
    to: connector.toSide,
  });
}

/** 矢羽根の向きを決める 2 点を返す。 */
function arrowBasis(
  path: ConnectorPath,
  end: "from" | "to",
): { tip: Point | undefined; previous: Point | undefined } {
  if (path.kind === "curve") {
    return end === "to"
      ? { tip: path.to, previous: path.control2 }
      : { tip: path.from, previous: path.control1 };
  }
  return end === "to"
    ? { tip: path.points.at(-1), previous: path.points.at(-2) }
    : { tip: path.points[0], previous: path.points[1] };
}

/** 端の印の最小の大きさ（画面 px）。細い線でも見える大きさを保つ。 */
export const CAP_LENGTHS: Record<CapSize, number> = {
  small: 8,
  medium: 12,
  large: 18,
};

/**
 * 端の印の大きさが線の太さの何倍あれば釣り合うか。
 * 太い線に小さい矢印を付けると、線に埋もれて向きが読み取れない。
 */
const CAP_WIDTH_RATIOS: Record<CapSize, number> = {
  small: 2.5,
  medium: 4,
  large: 6,
};

/**
 * 端の印の大きさ（画面 px）を求める。
 *
 * 設定の小・中・大は下限として働き、線が太いときはそれに比例して大きくなる。
 * こうすると細い線の見た目は変わらないまま、太い線でも釣り合いが取れる。
 */
export function capLength(size: CapSize, strokeWidth: number): number {
  return Math.max(CAP_LENGTHS[size], strokeWidth * CAP_WIDTH_RATIOS[size]);
}

/** 矢羽根の開き角（ラジアン）。 */
const ARROW_SPREAD = Math.PI / 7;

/** 矢印の三角形。`tip` が線の終点。 */
export interface ArrowHead {
  readonly tip: Point;
  readonly left: Point;
  readonly right: Point;
}

/**
 * 指定した端に描く矢羽根の 3 点を返す。
 *
 * 向きはその端と、隣の点（曲線ならベジェの制御点）から決める。
 * 経路の種類によらず「線がその端へ向かう向き」に矢印を合わせられる。
 */
export function arrowHead(
  path: ConnectorPath,
  end: "from" | "to" = "to",
  length: number = CAP_LENGTHS.medium,
): ArrowHead | null {
  const { tip, previous } = arrowBasis(path, end);

  if (tip === undefined || previous === undefined) {
    return null;
  }
  const dx = tip.x - previous.x;
  const dy = tip.y - previous.y;
  if (dx === 0 && dy === 0) {
    return null;
  }

  const angle = Math.atan2(dy, dx);
  return {
    tip,
    left: {
      x: tip.x - length * Math.cos(angle - ARROW_SPREAD),
      y: tip.y - length * Math.sin(angle - ARROW_SPREAD),
    },
    right: {
      x: tip.x - length * Math.cos(angle + ARROW_SPREAD),
      y: tip.y - length * Math.sin(angle + ARROW_SPREAD),
    },
  };
}

/** コネクタの端点。 */
export interface ConnectorEnd {
  /** 始点か終点か。 */
  readonly end: "from" | "to";
  readonly point: Point;
}

/**
 * 経路から両端の点を取り出す。
 *
 * 点が無い経路では空を返す。null ではなく空配列にすることで、
 * 呼び出し側が「無い場合」の分岐を書かずに済む。
 */
export function connectorEnds(path: ConnectorPath): readonly ConnectorEnd[] {
  if (path.kind === "curve") {
    return [
      { end: "from", point: path.from },
      { end: "to", point: path.to },
    ];
  }
  const from = path.points[0];
  const to = path.points.at(-1);
  return from === undefined || to === undefined
    ? []
    : [
        { end: "from", point: from },
        { end: "to", point: to },
      ];
}

/**
 * 矢羽根の付け根が先端からどれだけ手前にあるか。
 *
 * 線をここで止めれば、線の端のふくらみ（丸いキャップ）が矢印の先から
 * はみ出さず、先が尖って見える。
 */
export function arrowDepth(length: number): number {
  return length * Math.cos(ARROW_SPREAD);
}

/** 単位ベクトルを返す。長さ 0 なら null。 */
function directionTo(from: Point, to: Point): Point | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return null;
  }
  return { x: dx / length, y: dy / length };
}

/** 端の点を、隣の点へ向かって `distance` だけ動かした位置。 */
function pullBack(tip: Point, towards: Point, distance: number): Point | null {
  const direction = directionTo(tip, towards);
  if (direction === null) {
    return null;
  }
  // 区間より長く引っ込めて線が裏返らないよう、区間の長さで頭打ちにする
  const limit = Math.hypot(towards.x - tip.x, towards.y - tip.y);
  const moved = Math.min(distance, limit * 0.9);
  return {
    x: tip.x + direction.x * moved,
    y: tip.y + direction.y * moved,
  };
}

/**
 * 経路の指定した端を、線の向きに沿って `distance` だけ短くする。
 *
 * 端に印を描くとき、線がその下まで伸びていると印の形が崩れる。
 * 線を印の手前で止めるために使う。印そのものは元の経路に対して描くので、
 * 先端の位置はアイテムの境界のまま変わらない。
 */
export function trimPath(
  path: ConnectorPath,
  end: "from" | "to",
  distance: number,
): ConnectorPath {
  if (distance <= 0) {
    return path;
  }

  if (path.kind === "curve") {
    // 曲線の端の接線は端と手前の制御点を結ぶ向きなので、それに沿って戻す
    const tip = end === "to" ? path.to : path.from;
    const control = end === "to" ? path.control2 : path.control1;
    const moved = pullBack(tip, control, distance);
    if (moved === null) {
      return path;
    }
    return end === "to" ? { ...path, to: moved } : { ...path, from: moved };
  }

  const points = [...path.points];
  const tipIndex = end === "to" ? points.length - 1 : 0;
  const nextIndex = end === "to" ? points.length - 2 : 1;
  const tip = points[tipIndex];
  const next = points[nextIndex];
  if (tip === undefined || next === undefined) {
    return path;
  }
  const moved = pullBack(tip, next, distance);
  if (moved === null) {
    return path;
  }
  points[tipIndex] = moved;
  // 角の丸みなどの描き方の指定はそのまま引き継ぐ
  return { ...path, points };
}
