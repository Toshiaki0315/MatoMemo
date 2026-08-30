/**
 * アイテム 1 件を Canvas 2D に描画する。
 *
 * 呼び出し時点で ctx にはビューポートの変換が適用されている前提とし、
 * ここではワールド座標をそのまま使う。
 */

import type { Item, ShapeItem, StickyNoteItem, TextItem } from "../domain/board";
import type {
  ImageItem,
  TextAlign,
  TextAlignment,
  TextStyle,
  TextVerticalAlign,
} from "../domain/board";
import type { Rect } from "../domain/geometry";
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
import { dashPattern } from "./strokePattern";
import { wrapText } from "./textLayout";

/** 読み込み済み画像の参照表。id から描画可能な画像を引く。 */
export type ImageCache = ReadonlyMap<string, CanvasImageSource>;

export interface DrawItemOptions {
  readonly images?: ImageCache;
  /** 表示倍率。線の太さや破線の間隔を画面基準に保つために使う。 */
  readonly scale?: number;
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

/** 選択枠の見た目の太さ (px)。拡大率によらず一定に見せる。 */
const SELECTION_LINE_WIDTH = 2;

/** アイテムを描画する。 */
export function drawItem(
  ctx: CanvasRenderingContext2D,
  item: Item,
  options: DrawItemOptions = {},
): void {
  const hideText = options.hideText ?? false;
  const scale = options.scale ?? 1;
  switch (item.type) {
    case "sticky":
      drawSticky(ctx, item, hideText);
      return;
    case "shape":
      drawShape(ctx, item, hideText, scale);
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
    drawBoxedText(ctx, item.text, item);
  }
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  item: ShapeItem,
  hideText: boolean,
  scale: number,
): void {
  ctx.beginPath();
  if (item.shape === "circle") {
    traceEllipse(ctx, item);
  } else {
    ctx.rect(item.x, item.y, item.width, item.height);
  }
  if (item.fill !== null) {
    ctx.fillStyle = item.fill;
    ctx.fill();
  }
  ctx.strokeStyle = SHAPE_COLORS.border;
  // 線の太さと間隔は画面上で一定に見せたいので拡大率で割る
  ctx.lineWidth = item.strokeWidth / scale;
  ctx.setLineDash(dashPattern(item.strokeStyle, item.strokeWidth, scale));
  ctx.stroke();
  ctx.setLineDash([]);

  if (!hideText) {
    drawBoxedText(ctx, item.text, item);
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
  ctx.textAlign = item.align;
  ctx.textBaseline = "top";

  const lineHeight = item.fontSize * LINE_HEIGHT_RATIO;
  const lines = wrapText(
    item.text,
    item.width,
    (text) => ctx.measureText(text).width,
  );
  const x = horizontalAnchor(item, item.align, 0);
  const top = verticalStart(item, item.verticalAlign, lines.length, lineHeight, 0);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, top + index * lineHeight);
  });
}

/** 横方向の基準位置。`ctx.textAlign` と対で使う。 */
function horizontalAnchor(
  bounds: Rect,
  align: TextAlign,
  padding: number,
): number {
  switch (align) {
    case "left":
      return bounds.x + padding;
    case "right":
      return bounds.x + bounds.width - padding;
    default:
      return bounds.x + bounds.width / 2;
  }
}

/** 1 行目の上端。textBaseline は "top" を前提とする。 */
function verticalStart(
  bounds: Rect,
  verticalAlign: TextVerticalAlign,
  lineCount: number,
  lineHeight: number,
  padding: number,
): number {
  const textHeight = lineCount * lineHeight;
  switch (verticalAlign) {
    case "top":
      return bounds.y + padding;
    case "bottom":
      return bounds.y + bounds.height - padding - textHeight;
    default:
      return bounds.y + (bounds.height - textHeight) / 2;
  }
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

/** 枠の中にテキストを描く（付箋・図形の内部テキスト）。 */
function drawBoxedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  item: Rect & TextAlignment & TextStyle,
): void {
  if (text === "") {
    return;
  }
  ctx.font = `${item.fontSize}px "${item.fontFamily}", sans-serif`;
  ctx.fillStyle = ITEM_TEXT_COLOR;
  ctx.textAlign = item.align;
  ctx.textBaseline = "top";

  const lineHeight = item.fontSize * LINE_HEIGHT_RATIO;
  const maxLines = Math.max(
    1,
    Math.floor((item.height - TEXT_PADDING * 2) / lineHeight),
  );
  const lines = wrapText(
    text,
    item.width - TEXT_PADDING * 2,
    (value) => ctx.measureText(value).width,
    maxLines,
  );

  const x = horizontalAnchor(item, item.align, TEXT_PADDING);
  const top = verticalStart(
    item,
    item.verticalAlign,
    lines.length,
    lineHeight,
    TEXT_PADDING,
  );
  lines.forEach((line, index) => {
    ctx.fillText(line, x, top + index * lineHeight);
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
