import { describe, expect, it } from "vitest";
import { createShape, createStickyNote } from "../domain/board";
import {
  AUTO_FONT_SIZE_MAX,
  AUTO_FONT_SIZE_MIN,
  LINE_HEIGHT_RATIO,
  boxedFontSize,
  fitFontSize,
} from "./boxedText";
import { fontSizeOf } from "./textMeasure";

/** 1 文字の幅が文字の大きさと同じになる測り方（全角相当）。 */
const squareAt = (text: string, size: number) => [...text].length * size;

/** font 指定から大きさを読み、1 文字 = 1em として測る。 */
const squareMeasure = (text: string, font: string) =>
  [...text].length * fontSizeOf(font);

describe("fitFontSize", () => {
  it("1 行に収まる最大の大きさにする", () => {
    // 4 文字が幅 200 に収まるのは 50 まで。上限は 48
    expect(fitFontSize("あいうえ", 200, 200, squareAt)).toBe(AUTO_FONT_SIZE_MAX);
  });

  it("幅で決まる場合は幅に収まる大きさにする", () => {
    // 10 文字を 1 行に収めると 20、2 行に折ると 25 で高さ 70 に収まる
    expect(fitFontSize("あいうえおかきくけこ", 200, 70, squareAt)).toBe(25);
  });

  it("文章が長いほど小さくする", () => {
    const short = fitFontSize("短い", 176, 176, squareAt);
    const long = fitFontSize("とても長い文章を書いたときの文字", 176, 176, squareAt);
    expect(long).toBeLessThan(short);
  });

  it("高さで決まる場合は行数分の高さに収める", () => {
    const size = fitFontSize("あ\nい\nう", 1000, 100, squareAt);
    expect(3 * size * LINE_HEIGHT_RATIO).toBeLessThanOrEqual(100);
    expect(3 * (size + 1) * LINE_HEIGHT_RATIO).toBeGreaterThan(100);
  });

  it("下限でも収まらなければ下限にする", () => {
    expect(fitFontSize("あ".repeat(500), 50, 50, squareAt)).toBe(
      AUTO_FONT_SIZE_MIN,
    );
  });

  it("1 文字でも幅を超えるなら下限にする", () => {
    expect(fitFontSize("あ", 5, 100, squareAt)).toBe(AUTO_FONT_SIZE_MIN);
  });
});

describe("boxedFontSize", () => {
  it("固定ならその大きさをそのまま使う", () => {
    const note = createStickyNote({
      id: "s",
      x: 0,
      y: 0,
      fontSize: 24,
      fontSizeMode: "fixed",
    });
    expect(boxedFontSize(note, squareMeasure)).toBe(24);
  });

  it("設定が無い（古いファイルの）図形は固定として扱う", () => {
    const shape = createShape({
      id: "r",
      shape: "rectangle",
      x: 0,
      y: 0,
      fontSize: 20,
    });
    expect(boxedFontSize(shape, squareMeasure)).toBe(20);
  });

  it("自動なら余白を除いた枠に収まる大きさにする", () => {
    // 200 の付箋は余白 12 を除いて 176。10 文字を 2 行に折って 17
    const note = createStickyNote({
      id: "s",
      x: 0,
      y: 0,
      text: "あいうえおかきくけこさしすせそたちつてと",
    });
    const size = boxedFontSize(note, squareMeasure);
    expect(size).toBeGreaterThan(AUTO_FONT_SIZE_MIN);
    expect(size).toBeLessThan(AUTO_FONT_SIZE_MAX);
  });

  it("付箋を大きくすると文字も大きくなる", () => {
    const text = "あいうえおかきくけこさしすせそたちつてと";
    const small = createStickyNote({ id: "s", x: 0, y: 0, text, width: 150, height: 150 });
    const large = createStickyNote({ id: "l", x: 0, y: 0, text, width: 400, height: 400 });
    expect(boxedFontSize(large, squareMeasure)).toBeGreaterThan(
      boxedFontSize(small, squareMeasure),
    );
  });

  it("同じ内容は測り直さない", () => {
    let calls = 0;
    const counting = (text: string, font: string) => {
      calls += 1;
      return squareMeasure(text, font);
    };
    const note = createStickyNote({ id: "s", x: 0, y: 0, text: "メモ" });
    boxedFontSize(note, counting);
    const first = calls;
    boxedFontSize({ ...note, x: 500 }, counting);
    // 位置が変わっただけなら控えを使う
    expect(calls).toBe(first);
  });

  it("控えが増えすぎたら捨てて作り直す", () => {
    let calls = 0;
    const counting = (text: string, font: string) => {
      calls += 1;
      return squareMeasure(text, font);
    };
    const note = createStickyNote({ id: "s", x: 0, y: 0, text: "最初" });
    boxedFontSize(note, counting);
    for (let index = 0; index < 600; index += 1) {
      boxedFontSize({ ...note, text: `文章${index}` }, counting);
    }
    // 最初の文章の控えは捨てられているので、測り直す
    const before = calls;
    boxedFontSize(note, counting);
    expect(calls).toBeGreaterThan(before);
  });
});
