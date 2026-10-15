/**
 * ボードを画像 (SVG / PNG) として書き出す。
 *
 * 画面の表示位置やズームによらず、アイテム全体が収まる範囲を等倍で
 * 切り出す。グリッド・選択枠・ハンドルなど編集用の表示は含めない。
 */

import type { Board } from "../domain/board";
import { contentBounds } from "../domain/scrollbars";
import {
  CANVAS_THEME,
  renderBoard,
  type RenderBoardOptions,
} from "./boardRenderer";
import type { ImageCache } from "./itemRenderer";
import { SvgContext } from "./svgContext";
import { createCanvasMeasurer, type MeasureTextWidth } from "./textMeasure";

/** 内容の周囲に取る余白（ワールド px）。 */
export const EXPORT_MARGIN = 24;

/** PNG の解像度（等倍に対する倍率）。Retina でも粗くならないようにする。 */
export const PNG_EXPORT_SCALE = 2;

/** 内容が無いときに切り出す範囲。余白だけの小さな画像になる。 */
const EMPTY_CONTENT = { x: 0, y: 0, width: 0, height: 0 };

/**
 * 書き出し用の描画オプションを組み立てる。
 * アイテムが無いときは余白だけの範囲になる（空の画像として書き出せる）。
 */
export function exportRenderOptions(
  board: Board,
  images: ImageCache,
): RenderBoardOptions {
  const content = contentBounds(board.items) ?? EMPTY_CONTENT;
  return {
    width: content.width + EXPORT_MARGIN * 2,
    height: content.height + EXPORT_MARGIN * 2,
    devicePixelRatio: 1,
    // 内容の左上が余白の内側に来るように平行移動する
    viewport: {
      x: EXPORT_MARGIN - content.x,
      y: EXPORT_MARGIN - content.y,
      scale: 1,
    },
    theme: CANVAS_THEME.light,
    showGrid: false,
    items: board.items,
    connectors: board.connectors,
    images,
  };
}

/**
 * ボードを SVG 文書の文字列にする。
 * @param measure 文字幅の測定。省略時は Canvas を作って測る
 */
export function boardToSvg(
  board: Board,
  images: ImageCache,
  measure: MeasureTextWidth = createCanvasMeasurer(),
): string {
  const options = exportRenderOptions(board, images);
  const svg = new SvgContext(measure);
  // SvgContext は renderBoard が使う範囲の Canvas 2D API を実装している
  renderBoard(svg as unknown as CanvasRenderingContext2D, options);
  return svg.toSvg(options.width, options.height);
}

/**
 * ボードを Canvas に描き、PNG 化できる状態にする。
 * 2D コンテキストが取れない場合は false。
 */
export function drawBoardForPng(
  board: Board,
  images: ImageCache,
  canvas: HTMLCanvasElement,
): boolean {
  const options = exportRenderOptions(board, images);
  canvas.width = Math.round(options.width * PNG_EXPORT_SCALE);
  canvas.height = Math.round(options.height * PNG_EXPORT_SCALE);
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return false;
  }
  renderBoard(ctx, { ...options, devicePixelRatio: PNG_EXPORT_SCALE });
  return true;
}
