/**
 * ボードを Canvas 2D に描画する。
 *
 * 描画は「与えられた状態から画面を作る」だけの純粋な手続きとし、
 * 状態を持たない。呼び出し側が毎フレーム全体を描き直す。
 */

import type { Item, ItemId } from "../domain/board";
import type { Viewport } from "../domain/viewport";
import { computeGridLines } from "./grid";
import { drawItem, drawSelectionOutline, type ImageCache } from "./itemRenderer";

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
  /** 背面から前面の順に並ぶアイテム。 */
  readonly items?: readonly Item[];
  readonly selectedIds?: ReadonlySet<ItemId>;
  readonly images?: ImageCache;
  /** 編集中のアイテム。そのアイテムのテキストは Canvas 側では描かない。 */
  readonly editingItemId?: ItemId;
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

  drawItems(ctx, options);

  ctx.restore();
}

/**
 * アイテムをワールド座標のまま描く。
 *
 * ここでビューポートの変換を ctx に載せる。デバイスピクセル比と合成する
 * ことで、描画側は座標変換を意識せずワールド座標をそのまま渡せる。
 */
function drawItems(
  ctx: CanvasRenderingContext2D,
  options: RenderBoardOptions,
): void {
  const items = options.items ?? [];
  if (items.length === 0) {
    return;
  }
  const { devicePixelRatio: dpr, viewport } = options;
  const combined = dpr * viewport.scale;

  ctx.save();
  ctx.setTransform(
    combined,
    0,
    0,
    combined,
    dpr * viewport.x,
    dpr * viewport.y,
  );

  const baseOptions =
    options.images !== undefined ? { images: options.images } : {};
  for (const item of items) {
    drawItem(ctx, item, {
      ...baseOptions,
      hideText: item.id === options.editingItemId,
    });
  }

  // 選択枠はすべてのアイテムより前面に描く
  const selectedIds = options.selectedIds;
  if (selectedIds !== undefined) {
    for (const item of items) {
      if (selectedIds.has(item.id)) {
        drawSelectionOutline(ctx, item, viewport.scale);
      }
    }
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
