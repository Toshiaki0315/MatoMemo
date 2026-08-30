/**
 * キャンバスのビューポート（パン・ズームの状態）と座標変換。
 *
 * ビューポートは「ワールド座標 → 画面座標」のアフィン変換を表す。
 *
 *     screen = world * scale + (x, y)
 *
 * この並びは Canvas 2D の `setTransform(scale, 0, 0, scale, x, y)` に
 * そのまま対応するため、描画側で追加の計算が要らない。
 */

import { clamp, type Point, type Rect } from "./geometry";

/** ズーム倍率の下限。これ以上縮小しても操作できないため。 */
export const MIN_SCALE = 0.1;

/** ズーム倍率の上限。 */
export const MAX_SCALE = 8;

/** パン・ズームの状態。 */
export interface Viewport {
  /** 画面座標における平行移動量。 */
  readonly x: number;
  readonly y: number;
  /** 拡大率。1 が等倍。 */
  readonly scale: number;
}

/** 原点・等倍のビューポートを作る。 */
export function createViewport(): Viewport {
  return { x: 0, y: 0, scale: 1 };
}

/** ズーム倍率を許容範囲に丸める。 */
export function clampScale(scale: number): number {
  return clamp(scale, MIN_SCALE, MAX_SCALE);
}

/** ワールド座標を画面座標へ変換する。 */
export function toScreen(viewport: Viewport, point: Point): Point {
  return {
    x: point.x * viewport.scale + viewport.x,
    y: point.y * viewport.scale + viewport.y,
  };
}

/** 画面座標をワールド座標へ変換する。 */
export function toWorld(viewport: Viewport, point: Point): Point {
  return {
    x: (point.x - viewport.x) / viewport.scale,
    y: (point.y - viewport.y) / viewport.scale,
  };
}

/** 画面座標の移動量だけビューポートを平行移動する。 */
export function panBy(viewport: Viewport, dx: number, dy: number): Viewport {
  return { ...viewport, x: viewport.x + dx, y: viewport.y + dy };
}

/**
 * 画面上の `anchor` を固定点として拡大・縮小する。
 *
 * カーソル下のワールド座標が動かないよう平行移動量を調整するため、
 * 「カーソルの位置を中心に拡大する」直感的な操作になる。
 * 倍率が上下限に張り付いた場合も固定点は保たれる。
 */
export function zoomAt(
  viewport: Viewport,
  anchor: Point,
  factor: number,
): Viewport {
  const scale = clampScale(viewport.scale * factor);
  // 実際に適用された倍率の比。クランプされた場合はここが factor と一致しない。
  const applied = scale / viewport.scale;
  return {
    scale,
    x: anchor.x - (anchor.x - viewport.x) * applied,
    y: anchor.y - (anchor.y - viewport.y) * applied,
  };
}

/** 指定した画面サイズに映っているワールド座標の範囲を返す。 */
export function visibleWorldRect(
  viewport: Viewport,
  screenWidth: number,
  screenHeight: number,
): Rect {
  const topLeft = toWorld(viewport, { x: 0, y: 0 });
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: screenWidth / viewport.scale,
    height: screenHeight / viewport.scale,
  };
}

/**
 * 内容全体が画面に収まる倍率を返す。
 * 既に収まっている場合は拡大せず等倍のままにする。
 */
export function fitScaleToContent(
  content: Rect,
  screenWidth: number,
  screenHeight: number,
): number {
  if (content.width <= 0 || content.height <= 0) {
    return 1;
  }
  const scale = Math.min(
    screenWidth / content.width,
    screenHeight / content.height,
  );
  return clampScale(Math.min(scale, 1));
}
