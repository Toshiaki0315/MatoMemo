/**
 * 付箋・図形の内側に書く文字の配置と大きさ。
 *
 * Canvas の描画と、編集中に重ねる `<textarea>` の両方が同じ値を使う。
 * 片方だけ変えると、編集を始めた瞬間に文字が跳ねて見えるため、
 * 値はここに一本化する。
 */

import type { FontSizeMode, TextStyle } from "../domain/board";
import type { Rect } from "../domain/geometry";
import { wrapText } from "./textLayout";
import { cssFont, type MeasureTextWidth } from "./textMeasure";

/** 枠と文字の間の余白 (ワールド px)。 */
export const TEXT_PADDING = 12;

/** 行送り（フォントサイズに対する倍率）。 */
export const LINE_HEIGHT_RATIO = 1.4;

/** 自動のときの文字の大きさの下限。これより小さいと読めない。 */
export const AUTO_FONT_SIZE_MIN = 10;

/**
 * 自動のときの文字の大きさの上限。
 * 短い文章でも枠いっぱいの巨大な文字にならないよう抑える。
 */
export const AUTO_FONT_SIZE_MAX = 48;

/** 内側に文字を書く枠。 */
export interface BoxedText extends Rect, TextStyle {
  readonly text: string;
  readonly fontSizeMode?: FontSizeMode;
}

/**
 * 文章が枠に収まる最大の文字の大きさを求める（整数 px）。
 *
 * 大きさを変えると折り返し方も変わるので、折り返したうえで
 * 「行がはみ出さず、行数分の高さが収まる」かを確かめ、二分探索で探す。
 * 下限でも収まらないときは下限を返す（はみ出す分は描画側が省く）。
 * @param measureAt 指定した大きさでの文字幅を返す
 */
export function fitFontSize(
  text: string,
  maxWidth: number,
  maxHeight: number,
  measureAt: (text: string, size: number) => number,
): number {
  const fits = (size: number) => {
    const lines = wrapText(text, maxWidth, (value) => measureAt(value, size));
    if (lines.length * size * LINE_HEIGHT_RATIO > maxHeight) {
      return false;
    }
    // 1 文字で幅を超える場合は折り返しても収まらない
    return lines.every((line) => measureAt(line, size) <= maxWidth);
  };

  let low = AUTO_FONT_SIZE_MIN;
  let high = AUTO_FONT_SIZE_MAX;
  let best = AUTO_FONT_SIZE_MIN;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (fits(middle)) {
      best = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return best;
}

/** 測定関数ごとの、自動で求めた大きさの控え。 */
const caches = new WeakMap<MeasureTextWidth, Map<string, number>>();

/** 控えておく件数の上限。超えたら捨てて作り直す。 */
const CACHE_LIMIT = 500;

/**
 * 枠の内側に書く文字の大きさを返す。
 *
 * 自動のときは枠と文章に合わせて求める。描画のたびに求め直すと
 * 重いので、結果を文章・枠の大きさ・書体ごとに控えておく。
 */
export function boxedFontSize(
  item: BoxedText,
  measure: MeasureTextWidth,
): number {
  if (item.fontSizeMode !== "auto") {
    return item.fontSize;
  }
  const width = item.width - TEXT_PADDING * 2;
  const height = item.height - TEXT_PADDING * 2;
  const key = `${item.fontFamily}\u0000${width}\u0000${height}\u0000${item.text}`;

  let cache = caches.get(measure);
  if (cache === undefined) {
    cache = new Map();
    caches.set(measure, cache);
  }
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const size = fitFontSize(item.text, width, height, (text, candidate) =>
    measure(text, cssFont(candidate, item.fontFamily)),
  );
  if (cache.size >= CACHE_LIMIT) {
    cache.clear();
  }
  cache.set(key, size);
  return size;
}
