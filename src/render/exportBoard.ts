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
import { SvgContext, type MeasureTextWidth } from "./svgContext";

/** 内容の周囲に取る余白（ワールド px）。 */
export const EXPORT_MARGIN = 24;

/** PNG の解像度（等倍に対する倍率）。Retina でも粗くならないようにする。 */
export const PNG_EXPORT_SCALE = 2;

/**
 * 書き出し用の描画オプションを組み立てる。
 * アイテムが無く、書き出す内容が無い場合は null。
 */
export function exportRenderOptions(
  board: Board,
  images: ImageCache,
): RenderBoardOptions | null {
  const content = contentBounds(board.items);
  if (content === null) {
    return null;
  }
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
 * ボードを SVG 文書の文字列にする。アイテムが無ければ null。
 * @param measure 文字幅の測定。省略時は Canvas を作って測る
 */
export function boardToSvg(
  board: Board,
  images: ImageCache,
  measure: MeasureTextWidth = measureWithCanvas(),
): string | null {
  const options = exportRenderOptions(board, images);
  if (options === null) {
    return null;
  }
  const svg = new SvgContext(measure);
  // SvgContext は renderBoard が使う範囲の Canvas 2D API を実装している
  renderBoard(svg as unknown as CanvasRenderingContext2D, options);
  return svg.toSvg(options.width, options.height);
}

/**
 * ボードを Canvas に描き、PNG 化できる状態にする。
 * アイテムが無い、または 2D コンテキストが取れない場合は false。
 */
export function drawBoardForPng(
  board: Board,
  images: ImageCache,
  canvas: HTMLCanvasElement,
): boolean {
  const options = exportRenderOptions(board, images);
  if (options === null) {
    return false;
  }
  canvas.width = Math.round(options.width * PNG_EXPORT_SCALE);
  canvas.height = Math.round(options.height * PNG_EXPORT_SCALE);
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return false;
  }
  renderBoard(ctx, { ...options, devicePixelRatio: PNG_EXPORT_SCALE });
  return true;
}

/** 文字幅を実際の Canvas で測る関数を作る。作れない環境では概算にする。 */
function measureWithCanvas(): MeasureTextWidth {
  const ctx = document.createElement("canvas").getContext("2d");
  if (ctx === null) {
    return (text, font) => {
      // おおよそ全角 1em・半角 0.55em として見積もる
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 16);
      let width = 0;
      for (const char of text) {
        width += char.charCodeAt(0) > 0xff ? size : size * 0.55;
      }
      return width;
    };
  }
  return (text, font) => {
    ctx.font = font;
    return ctx.measureText(text).width;
  };
}
