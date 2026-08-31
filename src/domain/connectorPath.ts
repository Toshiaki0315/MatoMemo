/**
 * コネクタの経路計算。
 *
 * 経路はアイテムの現在位置から毎回求める。コネクタ自体に座標を持たせると
 * アイテムを動かすたびに更新が必要になり、取りこぼすと線が取り残される。
 * 「常に今の位置から計算する」ことで、追従の実装そのものが不要になる。
 */

import { clampBend, DEFAULT_BEND } from "./board";
import type { CapSize, ConnectorKind, Item } from "./board";
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
 * @param bend 中間の線の位置。始点側 0〜終点側 1 の割合
 */
function polylinePath(from: Rect, to: Rect, bend: number) {
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

/**
 * コネクタの経路を、接続先アイテムの現在位置から求める。
 * @param bend 折れ線の中間の線の位置。折れ線以外では使わない
 */
export function connectorPath(
  kind: ConnectorKind,
  fromItem: Item,
  toItem: Item,
  bend: number = DEFAULT_BEND,
): ConnectorPath {
  const from = boundsOf(fromItem);
  const to = boundsOf(toItem);

  switch (kind) {
    case "polyline":
      return polylinePath(from, to, bend);
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
  return { kind: "polyline", points };
}
