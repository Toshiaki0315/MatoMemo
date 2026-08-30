/**
 * キャンバス上の座標・矩形にまつわる純粋な幾何計算。
 *
 * このモジュールは DOM / Canvas / React に一切依存しない。
 * 座標系の単位はすべて「ワールド座標」であり、画面座標への変換は
 * `viewport.ts` が担当する。
 */

/** 2 次元の点。 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** 幅と高さ。 */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/** 左上を原点とする軸並行矩形。 */
export interface Rect extends Point, Size {}

/** `value` を `min`〜`max` の範囲に丸める。 */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

/**
 * 対角となる 2 点から矩形を作る。
 * ドラッグの向きに関わらず幅・高さが非負になるよう正規化する。
 */
export function rectFromCorners(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/** 矩形の中心点を返す。 */
export function rectCenter(rect: Rect): Point {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

/** 点が矩形の内部（辺上を含む）にあるかを判定する。 */
export function rectContainsPoint(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/** 2 つの矩形が重なる（辺が接する場合を含む）かを判定する。 */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x <= b.x + b.width &&
    b.x <= a.x + a.width &&
    a.y <= b.y + b.height &&
    b.y <= a.y + a.height
  );
}

/**
 * 点が矩形に内接する楕円の内部（縁を含む）にあるかを判定する。
 * 円形の図形の当たり判定に使う。
 */
export function ellipseContainsPoint(rect: Rect, point: Point): boolean {
  const radiusX = rect.width / 2;
  const radiusY = rect.height / 2;
  if (radiusX <= 0 || radiusY <= 0) {
    return false;
  }
  const center = rectCenter(rect);
  const normalizedX = (point.x - center.x) / radiusX;
  const normalizedY = (point.y - center.y) / radiusY;
  return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
}

/** `inner` が `outer` に完全に含まれるかを判定する。 */
export function rectContainsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}
