/**
 * アイテムの配色。
 *
 * 付箋の色は「視認性の良い薄いパステルカラー」という要件を満たす必要がある。
 * 主観に頼らず検証できるよう、テストで WCAG のコントラスト比を確認している。
 */

import type { StickyColor } from "../domain/board";

/** アイテム内のテキスト色。すべての付箋色の上で読める必要がある。 */
export const ITEM_TEXT_COLOR = "#2B2B2B";

/** テキストに要求するコントラスト比（WCAG 2.1 AA の通常サイズ相当）。 */
export const MIN_TEXT_CONTRAST = 4.5;

export interface ItemColors {
  /** 塗りの色。 */
  readonly fill: string;
  /** 枠線の色。塗りより濃くして境界を分かりやすくする。 */
  readonly border: string;
}

/** 付箋のパステル 6 色。 */
export const STICKY_PALETTE: Record<StickyColor, ItemColors> = {
  yellow: { fill: "#FFF3C4", border: "#E8CE72" },
  orange: { fill: "#FFE0C2", border: "#E9B078" },
  pink: { fill: "#FFD9E4", border: "#E896B0" },
  purple: { fill: "#E8DCFA", border: "#B49BE0" },
  blue: { fill: "#D4E8FA", border: "#89B6DE" },
  green: { fill: "#D6EFD6", border: "#8CC48C" },
};

/** 図形（矩形・円）の既定の配色。 */
export const SHAPE_COLORS: ItemColors = {
  fill: "#FFFFFF",
  border: "#8A93A6",
};

/** 選択中のアイテムを囲む枠の色。 */
export const SELECTION_COLOR = "#3B82F6";

/** 範囲ドラッグ中の選択範囲の塗り。下のアイテムが透けるよう薄くする。 */
export const SELECTION_RECT_FILL = "rgba(59, 130, 246, 0.12)";
