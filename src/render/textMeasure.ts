/**
 * 文字幅の測定。
 *
 * 文字の折り返しや、枠に収まる文字の大きさを求めるのに使う。Canvas の
 * 描画中は描画中のコンテキストで、それ以外（編集欄・書き出し）では
 * 測定用に作った Canvas で測る。Canvas が使えない環境では概算にする。
 */

/** 文字幅を測る関数。`font` は Canvas の font 指定の書式。 */
export type MeasureTextWidth = (text: string, font: string) => number;

/** Canvas と CSS で共通に使う font 指定を作る。 */
export function cssFont(size: number, family: string): string {
  return `${size}px "${family}", sans-serif`;
}

/** font 指定から大きさ (px) を取り出す。読み取れなければ 16。 */
export function fontSizeOf(font: string): number {
  const match = /(\d+(?:\.\d+)?)px/.exec(font);
  return match === null ? 16 : Number(match[1]);
}

/**
 * 文字幅の概算 (px)。
 * 全角をおおよそ 1em、半角を 0.55em とみなす。測定手段が無い環境の予備。
 */
export function approximateTextWidth(text: string, font: string): number {
  const size = fontSizeOf(font);
  let width = 0;
  for (const char of text) {
    width += char.charCodeAt(0) > 0xff ? size : size * 0.55;
  }
  return width;
}

/**
 * 測定用の Canvas で文字幅を測る関数を作る。
 *
 * Canvas は最初に測るときに作る。作った関数を使い回せば、測定のための
 * Canvas も 1 つで済む。Canvas が使えない環境では概算に切り替える。
 */
export function createCanvasMeasurer(): MeasureTextWidth {
  let ctx: CanvasRenderingContext2D | null | undefined;
  return (text, font) => {
    ctx ??= document.createElement("canvas").getContext("2d");
    if (ctx === null) {
      return approximateTextWidth(text, font);
    }
    ctx.font = font;
    return ctx.measureText(text).width;
  };
}
