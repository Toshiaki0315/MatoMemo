/**
 * 色の解析とコントラスト比の計算。
 *
 * 付箋や図形の配色が読みやすいかを自動で検証するために使う。
 * 計算は WCAG 2.1 の相対輝度・コントラスト比の定義に従う。
 */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const HEX_PATTERN = /^#?(?:([0-9a-f]{3})|([0-9a-f]{6}))$/i;

/** `#RGB` または `#RRGGBB` 形式の色を解析する。 */
export function parseHexColor(color: string): Rgb {
  const match = HEX_PATTERN.exec(color);
  if (match === null) {
    throw new Error(`色の表記が不正です: ${color}`);
  }
  const short = match[1];
  const hex =
    short !== undefined
      ? short
          .split("")
          .map((char) => char + char)
          .join("")
      : (match[2] as string);
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

/** 1 チャンネル分をガンマ補正して線形値に戻す。 */
function toLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

/** WCAG の相対輝度（0 が黒、1 が白）。 */
export function relativeLuminance(color: string): number {
  const { r, g, b } = parseHexColor(color);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** 2 色のコントラスト比（1〜21）。大きいほど読みやすい。 */
export function contrastRatio(a: string, b: string): number {
  const luminanceA = relativeLuminance(a);
  const luminanceB = relativeLuminance(b);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}
