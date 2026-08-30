/**
 * アイテム 1 件を Canvas 2D に描画する。
 *
 * 呼び出し時点で ctx にはビューポートの変換が適用されている前提とし、
 * ここではワールド座標をそのまま使う。
 */

import type { Item, ShapeItem, StickyNoteItem, TextItem } from "../domain/board";
import type { ImageItem } from "../domain/board";
import {
  HANDLE_SIZE,
  RESIZE_HANDLES,
  handlePosition,
} from "../domain/resize";
import {
  ITEM_TEXT_COLOR,
  SELECTION_COLOR,
  SHAPE_COLORS,
  STICKY_PALETTE,
} from "./palette";
import { wrapText } from "./textLayout";

/** 読み込み済み画像の参照表。id から描画可能な画像を引く。 */
export type ImageCache = ReadonlyMap<string, CanvasImageSource>;

export interface DrawItemOptions {
  readonly images?: ImageCache;
  /**
   * テキストを描かない。編集中のアイテムに指定する。
   * 編集用の `<textarea>` を重ねている間に Canvas 側も描くと、
   * 文字が二重に見えてしまうため。
   */
  readonly hideText?: boolean;
}

/** 付箋・図形の角の丸み。 */
const CORNER_RADIUS = 6;

/** アイテム内テキストの余白。 */
const TEXT_PADDING = 12;

/** 行送り（フォントサイズに対する倍率）。 */
const LINE_HEIGHT_RATIO = 1.4;

/** 付箋・図形の内部テキストの既定サイズ。 */
const ITEM_FONT_SIZE = 16;
const ITEM_FONT_FAMILY = "Hiragino Sans";

/** 選択枠の見た目の太さ (px)。拡大率によらず一定に見せる。 */
const SELECTION_LINE_WIDTH = 2;

/** アイテムを描画する。 */
export function drawItem(
  ctx: CanvasRenderingContext2D,
  item: Item,
  options: DrawItemOptions = {},
): void {
  const hideText = options.hideText ?? false;
  switch (item.type) {
    case "sticky":
      drawSticky(ctx, item, hideText);
      return;
    case "shape":
      drawShape(ctx, item, hideText);
      return;
    case "text":
      drawText(ctx, item, hideText);
      return;
    case "image":
      drawImage(ctx, item, options.images);
  }
}

function drawSticky(
  ctx: CanvasRenderingContext2D,
  item: StickyNoteItem,
  hideText: boolean,
): void {
  const colors = STICKY_PALETTE[item.color];

  ctx.beginPath();
  ctx.roundRect(item.x, item.y, item.width, item.height, CORNER_RADIUS);
  ctx.fillStyle = colors.fill;
  ctx.fill();
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  if (!hideText) {
    drawCenteredText(ctx, item.text, item);
  }
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  item: ShapeItem,
  hideText: boolean,
): void {
  ctx.beginPath();
  if (item.shape === "circle") {
    traceEllipse(ctx, item);
  } else {
    ctx.rect(item.x, item.y, item.width, item.height);
  }
  ctx.fillStyle = SHAPE_COLORS.fill;
  ctx.fill();
  ctx.strokeStyle = SHAPE_COLORS.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  if (!hideText) {
    drawCenteredText(ctx, item.text, item);
  }
}

function drawText(
  ctx: CanvasRenderingContext2D,
  item: TextItem,
  hideText: boolean,
): void {
  if (hideText || item.text === "") {
    return;
  }
  ctx.font = `${item.fontSize}px "${item.fontFamily}", sans-serif`;
  ctx.fillStyle = ITEM_TEXT_COLOR;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const lineHeight = item.fontSize * LINE_HEIGHT_RATIO;
  const lines = wrapText(
    item.text,
    item.width,
    (text) => ctx.measureText(text).width,
  );
  lines.forEach((line, index) => {
    ctx.fillText(line, item.x, item.y + index * lineHeight);
  });
}

function drawImage(
  ctx: CanvasRenderingContext2D,
  item: ImageItem,
  images: ImageCache | undefined,
): void {
  const bitmap = images?.get(item.id);
  if (bitmap === undefined) {
    // 読み込みが終わるまでは枠だけを描いて、位置と大きさを示しておく
    ctx.beginPath();
    ctx.rect(item.x, item.y, item.width, item.height);
    ctx.fillStyle = SHAPE_COLORS.fill;
    ctx.fill();
    ctx.strokeStyle = SHAPE_COLORS.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    return;
  }
  ctx.drawImage(bitmap, item.x, item.y, item.width, item.height);
}

/** アイテムの中央にテキストを描く（付箋・図形の内部テキスト）。 */
function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  bounds: { x: number; y: number; width: number; height: number },
): void {
  if (text === "") {
    return;
  }
  ctx.font = `${ITEM_FONT_SIZE}px "${ITEM_FONT_FAMILY}", sans-serif`;
  ctx.fillStyle = ITEM_TEXT_COLOR;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lineHeight = ITEM_FONT_SIZE * LINE_HEIGHT_RATIO;
  const maxLines = Math.max(
    1,
    Math.floor((bounds.height - TEXT_PADDING * 2) / lineHeight),
  );
  const lines = wrapText(
    text,
    bounds.width - TEXT_PADDING * 2,
    (value) => ctx.measureText(value).width,
    maxLines,
  );

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const firstLineY = centerY - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, centerX, firstLineY + index * lineHeight);
  });
}

/** 選択中のアイテムを囲む枠を描く。 */
export function drawSelectionOutline(
  ctx: CanvasRenderingContext2D,
  item: Item,
  scale: number,
): void {
  ctx.beginPath();
  if (item.type === "shape" && item.shape === "circle") {
    traceEllipse(ctx, item);
  } else {
    ctx.rect(item.x, item.y, item.width, item.height);
  }
  ctx.strokeStyle = SELECTION_COLOR;
  // 変換が掛かった座標系で描くため、見た目の太さを一定にするには
  // 拡大率で割る必要がある
  ctx.lineWidth = SELECTION_LINE_WIDTH / scale;
  ctx.stroke();
}

/**
 * リサイズハンドルを描く。
 *
 * ハンドルは拡大率によらず同じ大きさに見せたいので、辺の長さを
 * 拡大率で割ってワールド座標に換算する。
 */
export function drawResizeHandles(
  ctx: CanvasRenderingContext2D,
  item: Item,
  scale: number,
): void {
  const size = HANDLE_SIZE / scale;
  const half = size / 2;
  const bounds = {
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
  };

  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = SELECTION_LINE_WIDTH / scale;

  for (const handle of RESIZE_HANDLES) {
    const center = handlePosition(bounds, handle);
    ctx.beginPath();
    ctx.rect(center.x - half, center.y - half, size, size);
    ctx.fill();
    ctx.stroke();
  }
}

/** 外接矩形に内接する楕円のパスを引く。 */
function traceEllipse(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
): void {
  ctx.ellipse(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
    bounds.width / 2,
    bounds.height / 2,
    0,
    0,
    Math.PI * 2,
  );
}
