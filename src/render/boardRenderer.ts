/**
 * ボードを Canvas 2D に描画する。
 *
 * 描画は「与えられた状態から画面を作る」だけの純粋な手続きとし、
 * 状態を持たない。呼び出し側が毎フレーム全体を描き直す。
 */

import type { Board, ConnectorId, Item, ItemId } from "../domain/board";
import { connectorPath } from "../domain/connectorPath";
import type { Rect } from "../domain/geometry";
import type { Viewport } from "../domain/viewport";
import { computeGridLines } from "./grid";
import { drawConnector, drawConnectorHandles } from "./connectorRenderer";
import { SELECTION_COLOR, SELECTION_RECT_FILL } from "./palette";
import {
  drawItem,
  drawResizeHandles,
  drawSelectionOutline,
  type ImageCache,
} from "./itemRenderer";

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
  /** ドラッグ中の選択範囲（ワールド座標）。 */
  readonly selectionRect?: Rect;
  /** 描画するコネクタ。アイテムの現在位置から経路を毎回計算する。 */
  readonly connectors?: Board["connectors"];
  readonly selectedConnectorId?: ConnectorId;
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
  if (items.length === 0 && options.selectionRect === undefined) {
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

  // コネクタはアイテムより背面に描く。線がアイテムの上に乗ると、
  // 付箋の文字が読みづらくなるため。
  drawConnectors(ctx, options, items);

  const baseOptions = {
    scale: viewport.scale,
    ...(options.images !== undefined ? { images: options.images } : {}),
  };
  for (const item of items) {
    drawItem(ctx, item, {
      ...baseOptions,
      hideText: item.id === options.editingItemId,
    });
  }

  drawSelectionRect(ctx, options);

  // 選択枠はすべてのアイテムより前面に描く
  const selectedIds = options.selectedIds;
  if (selectedIds !== undefined) {
    const selected = items.filter((item) => selectedIds.has(item.id));
    for (const item of selected) {
      drawSelectionOutline(ctx, item, viewport.scale);
    }
    // ハンドルは 1 件だけ選んでいるときに出す。複数選択のまま個別に
    // リサイズできても混乱するだけなので出さない。
    const only = selected.length === 1 ? selected[0] : undefined;
    if (only !== undefined) {
      drawResizeHandles(ctx, only, viewport.scale);
    }
  }

  ctx.restore();
}

/** ドラッグ中の選択範囲を描く。 */
function drawSelectionRect(
  ctx: CanvasRenderingContext2D,
  options: RenderBoardOptions,
): void {
  const rect = options.selectionRect;
  if (rect === undefined) {
    return;
  }
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.width, rect.height);
  ctx.fillStyle = SELECTION_RECT_FILL;
  ctx.fill();
  ctx.strokeStyle = SELECTION_COLOR;
  // 変換が掛かった座標系で描くため、見た目の太さを一定にするには
  // 拡大率で割る必要がある
  ctx.lineWidth = 1 / options.viewport.scale;
  ctx.stroke();
}

/** コネクタを描く。接続先が見つからないものは飛ばす。 */
function drawConnectors(
  ctx: CanvasRenderingContext2D,
  options: RenderBoardOptions,
  items: readonly Item[],
): void {
  const connectors = options.connectors ?? [];
  if (connectors.length === 0) {
    return;
  }
  const byId = new Map(items.map((item) => [item.id, item]));

  for (const connector of connectors) {
    const fromItem = byId.get(connector.fromItemId);
    const toItem = byId.get(connector.toItemId);
    if (fromItem === undefined || toItem === undefined) {
      continue;
    }
    const path = connectorPath(connector.kind, fromItem, toItem);
    const selected = connector.id === options.selectedConnectorId;
    drawConnector(ctx, path, options.viewport.scale, {
      selected,
      startCap: connector.startCap,
      endCap: connector.endCap,
      capSize: connector.capSize,
      stroke: connector,
    });
    if (selected) {
      drawConnectorHandles(ctx, path, options.viewport.scale);
    }
  }
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
