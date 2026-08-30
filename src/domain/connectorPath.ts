/**
 * コネクタの経路計算。
 *
 * 経路はアイテムの現在位置から毎回求める。コネクタ自体に座標を持たせると
 * アイテムを動かすたびに更新が必要になり、取りこぼすと線が取り残される。
 * 「常に今の位置から計算する」ことで、追従の実装そのものが不要になる。
 */

import type { ConnectorKind, Item } from "./board";
import { rectCenter, type Point, type Rect } from "./geometry";

/** アイテムの輪郭の種類。円だけが楕円、それ以外は矩形として扱う。 */
export type Outline = "rectangle" | "ellipse";

/** 矩形の辺。 */
export type Side = "top" | "right" | "bottom" | "left";

/** 描画に必要な経路の情報。 */
export type ConnectorPath =
  | { readonly kind: "polyline"; readonly points: readonly Point[] }
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

/** 指定した辺の中点。円の場合もこの点は楕円上にある。 */
export function sideAnchor(bounds: Rect, side: Side): Point {
  const center = rectCenter(bounds);
  switch (side) {
    case "left":
      return { x: bounds.x, y: center.y };
    case "right":
      return { x: bounds.x + bounds.width, y: center.y };
    case "top":
      return { x: center.x, y: bounds.y };
    default:
      return { x: center.x, y: bounds.y + bounds.height };
  }
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

/** 2 点を直線で結ぶ経路。 */
function straightPath(from: Rect, to: Rect, fromItem: Item, toItem: Item) {
  const fromAnchor = boundaryAnchor(from, rectCenter(to), outlineOf(fromItem));
  const toAnchor = boundaryAnchor(to, rectCenter(from), outlineOf(toItem));
  return { kind: "polyline", points: [fromAnchor, toAnchor] } as const;
}

/**
 * 直交する折れ線で結ぶ経路。
 * 向かい合う辺から出て、中間で一度だけ折れる 3 区間の経路にする。
 */
function polylinePath(from: Rect, to: Rect) {
  const { fromSide, toSide, horizontal } = facingSides(from, to);
  const start = sideAnchor(from, fromSide);
  const end = sideAnchor(to, toSide);

  if (horizontal) {
    const middleX = (start.x + end.x) / 2;
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
  const middleY = (start.y + end.y) / 2;
  return {
    kind: "polyline",
    points: [start, { x: start.x, y: middleY }, { x: end.x, y: middleY }, end],
  } as const;
}

/**
 * 3 次ベジェ曲線で結ぶ経路。
 * 制御点を接続する辺の法線方向に張り出させ、辺から垂直に出ていくようにする。
 */
function curvedPath(from: Rect, to: Rect) {
  const { fromSide, toSide, horizontal } = facingSides(from, to);
  const start = sideAnchor(from, fromSide);
  const end = sideAnchor(to, toSide);

  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const bulge = Math.max(MIN_CURVE_BULGE, distance * CURVE_BULGE_RATIO);

  if (horizontal) {
    const direction = fromSide === "right" ? 1 : -1;
    return {
      kind: "curve",
      from: start,
      control1: { x: start.x + bulge * direction, y: start.y },
      control2: { x: end.x - bulge * direction, y: end.y },
      to: end,
    } as const;
  }
  const direction = fromSide === "bottom" ? 1 : -1;
  return {
    kind: "curve",
    from: start,
    control1: { x: start.x, y: start.y + bulge * direction },
    control2: { x: end.x, y: end.y - bulge * direction },
    to: end,
  } as const;
}

/** コネクタの経路を、接続先アイテムの現在位置から求める。 */
export function connectorPath(
  kind: ConnectorKind,
  fromItem: Item,
  toItem: Item,
): ConnectorPath {
  const from = boundsOf(fromItem);
  const to = boundsOf(toItem);

  switch (kind) {
    case "polyline":
      return polylinePath(from, to);
    case "curved":
      return curvedPath(from, to);
    default:
      return straightPath(from, to, fromItem, toItem);
  }
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

/** 矢羽根の長さ（ワールド座標）。 */
export const ARROW_LENGTH = 12;

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
      x: tip.x - ARROW_LENGTH * Math.cos(angle - ARROW_SPREAD),
      y: tip.y - ARROW_LENGTH * Math.sin(angle - ARROW_SPREAD),
    },
    right: {
      x: tip.x - ARROW_LENGTH * Math.cos(angle + ARROW_SPREAD),
      y: tip.y - ARROW_LENGTH * Math.sin(angle + ARROW_SPREAD),
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
