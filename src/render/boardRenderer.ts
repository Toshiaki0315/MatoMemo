/**
 * ボードを Canvas 2D に描画する。
 *
 * 描画は「与えられた状態から画面を作る」だけの純粋な手続きとし、
 * 状態を持たない。呼び出し側が毎フレーム全体を描き直す。
 */

import type { Viewport } from "../domain/viewport";
import { computeGridLines } from "./grid";

/** キャンバスの配色。 */
export interface CanvasTheme {
  readonly background: string;
  readonly gridLine: string;
}

export const CANVAS_THEME = {
  light: {
    background: "#F7F7F5",
    gridLine: "#E2E2DD",
  },
  dark: {
    background: "#1C2029",
    gridLine: "#2A3040",
  },
} as const satisfies Record<string, CanvasTheme>;

export interface RenderBoardOptions {
  /** CSS ピクセルでのキャンバスサイズ。 */
  readonly width: number;
  readonly height: number;
  /** Retina 対応のためのデバイスピクセル比。 */
  readonly devicePixelRatio: number;
  readonly viewport: Viewport;
  readonly theme?: CanvasTheme;
  readonly showGrid?: boolean;
}

/** グリッド線の太さ (px)。ズームしても一定にするため画面座標で描く。 */
const GRID_LINE_WIDTH = 1;

/** ボード全体を描画する。 */
export function renderBoard(
  ctx: CanvasRenderingContext2D,
  options: RenderBoardOptions,
): void {
  const theme = options.theme ?? CANVAS_THEME.light;
  const { width, height, devicePixelRatio, viewport } = options;

  ctx.save();

  // キャンバスのバッキングストアは devicePixelRatio 倍で確保されているため、
  // ここで一度だけ倍率を合わせ、以降は CSS ピクセルで描画できるようにする。
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);

  if (options.showGrid !== false) {
    drawGrid(ctx, viewport, width, height, theme);
  }

  ctx.restore();
}

/**
 * 背景グリッドを描く。
 *
 * 線はワールド座標ではなく画面座標で引く。そうしないとズーム時に線の太さまで
 * 拡大され、拡大率が高いときにグリッドが太い帯に見えてしまう。
 */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  width: number,
  height: number,
  theme: CanvasTheme,
): void {
  const lines = computeGridLines(viewport, width, height);

  ctx.strokeStyle = theme.gridLine;
  ctx.lineWidth = GRID_LINE_WIDTH;
  ctx.beginPath();

  for (const x of lines.vertical) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (const y of lines.horizontal) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }

  ctx.stroke();
}
