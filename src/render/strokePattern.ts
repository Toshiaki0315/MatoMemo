/**
 * 線種の破線パターン。
 *
 * パターンは画面上の見た目で決めたいので、ワールド座標に換算して返す。
 * そうしないと拡大するほど破線の間隔まで伸びてしまう。
 */

import type { StrokeStyle } from "../domain/board";

/** 線種ごとの「線・間隔」の並び（画面 px）。 */
const PATTERNS: Record<StrokeStyle, readonly number[]> = {
  solid: [],
  dashed: [10, 6],
  dotted: [1, 4],
  dashDot: [12, 4, 1, 4],
};

/**
 * Canvas の `setLineDash` に渡すパターンを返す。
 * @param scale 表示倍率
 */
export function dashPattern(
  style: StrokeStyle,
  scale: number,
): readonly number[] {
  return PATTERNS[style].map((length) => length / scale);
}
