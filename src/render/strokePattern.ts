/**
 * 線種の破線パターン。
 *
 * パターンは線の太さの倍数で持つ。太い線に細い線と同じ間隔を使うと、
 * 隙間が潰れて実線に見えてしまうため。
 * 返す長さはワールド座標に換算する。そうしないと拡大するほど
 * 破線の間隔まで伸びてしまう。
 */

import type { StrokeStyle } from "../domain/board";

/** 線種ごとの「線・間隔」の並び。値は線の太さに対する倍率。 */
const PATTERNS: Record<StrokeStyle, readonly number[]> = {
  solid: [],
  dashed: [4, 3],
  dotted: [1, 2],
  dashDot: [5, 2.5, 1, 2.5],
};

/**
 * 細い線でも間隔が詰まりすぎないよう、太さの下限を設ける。
 * 1px の線をそのまま使うと 4px の破線になり、実線と見分けが付かない。
 */
const MIN_PATTERN_UNIT = 2.5;

/**
 * Canvas の `setLineDash` に渡すパターンを返す。
 *
 * @param strokeWidth 線の太さ（画面 px）
 * @param scale 表示倍率
 */
export function dashPattern(
  style: StrokeStyle,
  strokeWidth: number,
  scale: number,
): readonly number[] {
  const unit = Math.max(strokeWidth, MIN_PATTERN_UNIT);
  return PATTERNS[style].map((ratio) => (ratio * unit) / scale);
}
