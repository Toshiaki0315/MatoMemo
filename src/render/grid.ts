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
  /** ひとつ細かい縦線の x 座標。実線の中間に並ぶ。 */
  readonly minorVertical: readonly number[];
  /** ひとつ細かい横線の y 座標。 */
  readonly minorHorizontal: readonly number[];
  /**
   * 細かい線の濃さ (0 以上 1 未満)。
   * 切り替わった直後は 0 で、次の切り替わりに向けて 1 に近づく。
   */
  readonly minorAlpha: number;
  /** 採用したワールド座標での間隔。 */
  readonly spacing: number;
}

/**
 * 細かい線の濃さを返す。
 *
 * 拡大するにつれて細かい線が濃くなり、濃さが 1 に達するあたりで
 * 間隔が半分に切り替わって、その線が実線になる。入れ替わった直後の
 * 細かい線はまた 0 から始まるので、見た目の濃さは途切れない。
 *
 * `gridSpacingForScale` が画面上の間隔を
 * `[MIN_GRID_SCREEN_SPACING, MIN_GRID_SCREEN_SPACING * 2)` に保つため、
 * 返す値は常に 0 以上 1 未満になる。
 */
export function minorGridAlpha(scale: number): number {
  const screenSpacing = gridSpacingForScale(scale) * scale;
  return (screenSpacing - MIN_GRID_SCREEN_SPACING) / MIN_GRID_SCREEN_SPACING;
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

/** 1 方向分の線の位置。実線と、その中間に入る細かい線に分ける。 */
interface AxisLines {
  readonly major: number[];
  readonly minor: number[];
}

/**
 * 1 方向分の線の位置を求める。
 *
 * 半分の間隔で数え、偶数番目を実線、奇数番目を細かい線とする。
 * 位置は添字から求め、足し込みによる誤差が溜まらないようにする。
 */
function linesAlongAxis(
  worldStart: number,
  screenLength: number,
  spacing: number,
  scale: number,
  translate: number,
): AxisLines {
  const major: number[] = [];
  const minor: number[] = [];
  if (screenLength <= 0) {
    return { major, minor };
  }
  const step = spacing / 2;
  const firstIndex = Math.ceil(worldStart / step);
  for (
    let index = firstIndex;
    index * step * scale + translate <= screenLength;
    index += 1
  ) {
    const position = index * step * scale + translate;
    if (index % 2 === 0) {
      major.push(position);
    } else {
      minor.push(position);
    }
  }
  return { major, minor };
}

/** 指定した画面サイズに描くべきグリッド線を計算する。 */
export function computeGridLines(
  viewport: Viewport,
  screenWidth: number,
  screenHeight: number,
): GridLines {
  const spacing = gridSpacingForScale(viewport.scale);
  const topLeft = toWorld(viewport, { x: 0, y: 0 });
  const x = linesAlongAxis(
    topLeft.x,
    screenWidth,
    spacing,
    viewport.scale,
    viewport.x,
  );
  const y = linesAlongAxis(
    topLeft.y,
    screenHeight,
    spacing,
    viewport.scale,
    viewport.y,
  );
  return {
    spacing,
    vertical: x.major,
    horizontal: y.major,
    minorVertical: x.minor,
    minorHorizontal: y.minor,
    minorAlpha: minorGridAlpha(viewport.scale),
  };
}
