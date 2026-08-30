/**
 * 背景グリッドの線の位置を計算する。
 *
 * 描画そのものは行わず、画面座標での線の位置だけを返す純関数に留める。
 * これにより Canvas なしでテストできる。
 */

import { toWorld, type Viewport } from "../domain/viewport";

/** 等倍のときのグリッド間隔（ワールド座標）。 */
export const BASE_GRID_SPACING = 50;

/** 画面上でグリッド線が最低限空けるべき間隔 (px)。 */
export const MIN_GRID_SCREEN_SPACING = 24;

/** 計算されたグリッド線。位置は画面座標。 */
export interface GridLines {
  /** 縦線の x 座標。 */
  readonly vertical: readonly number[];
  /** 横線の y 座標。 */
  readonly horizontal: readonly number[];
  /** 採用したワールド座標での間隔。 */
  readonly spacing: number;
}

/**
 * 倍率に応じたグリッド間隔（ワールド座標）を返す。
 *
 * 間隔は基準値の 2 のべき乗倍に限定し、画面上の間隔が常に
 * `[MIN_GRID_SCREEN_SPACING, MIN_GRID_SCREEN_SPACING * 2)` に収まるよう選ぶ。
 * 2 のべき乗に揃えることで、ズームしてもグリッドが元の線の位置を保ったまま
 * 細かく/粗くなり、線が滑る印象を与えない。
 */
export function gridSpacingForScale(scale: number): number {
  const steps = Math.ceil(
    Math.log2(MIN_GRID_SCREEN_SPACING / (BASE_GRID_SPACING * scale)),
  );
  return BASE_GRID_SPACING * 2 ** steps;
}

/** 1 方向分の線の位置を求める。 */
function linesAlongAxis(
  worldStart: number,
  screenLength: number,
  spacing: number,
  scale: number,
  translate: number,
): number[] {
  if (screenLength <= 0) {
    return [];
  }
  const positions: number[] = [];
  const firstLine = Math.ceil(worldStart / spacing) * spacing;
  for (
    let world = firstLine;
    world * scale + translate <= screenLength;
    world += spacing
  ) {
    positions.push(world * scale + translate);
  }
  return positions;
}

/** 指定した画面サイズに描くべきグリッド線を計算する。 */
export function computeGridLines(
  viewport: Viewport,
  screenWidth: number,
  screenHeight: number,
): GridLines {
  const spacing = gridSpacingForScale(viewport.scale);
  const topLeft = toWorld(viewport, { x: 0, y: 0 });
  return {
    spacing,
    vertical: linesAlongAxis(
      topLeft.x,
      screenWidth,
      spacing,
      viewport.scale,
      viewport.x,
    ),
    horizontal: linesAlongAxis(
      topLeft.y,
      screenHeight,
      spacing,
      viewport.scale,
      viewport.y,
    ),
  };
}
