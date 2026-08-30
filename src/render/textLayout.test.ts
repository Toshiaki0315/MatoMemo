import { describe, expect, it } from "vitest";
import { wrapText } from "./textLayout";

/** 1 文字 10px 幅として測るモック。 */
const measure = (text: string) => text.length * 10;

describe("wrapText", () => {
  it("収まるテキストはそのまま 1 行にする", () => {
    expect(wrapText("abc", 100, measure)).toEqual(["abc"]);
  });

  it("空文字は空の 1 行を返す", () => {
    expect(wrapText("", 100, measure)).toEqual([""]);
  });

  it("明示的な改行で分ける", () => {
    expect(wrapText("abc\ndef", 100, measure)).toEqual(["abc", "def"]);
  });

  it("連続した改行で空行を保つ", () => {
    expect(wrapText("a\n\nb", 100, measure)).toEqual(["a", "", "b"]);
  });

  it("幅を超えたら折り返す", () => {
    expect(wrapText("abcdefgh", 50, measure)).toEqual(["abcde", "fgh"]);
  });

  it("空白があれば単語の途中で切らない", () => {
    expect(wrapText("aaa bbb ccc", 70, measure)).toEqual(["aaa bbb", "ccc"]);
  });

  it("単語が 1 行に収まらない場合は文字単位で切る", () => {
    // "aaa bb" は 60px で幅 50px に収まらないため、"bb" は次の行になる
    expect(wrapText("aaaaaaaa bb", 50, measure)).toEqual([
      "aaaaa",
      "aaa",
      "bb",
    ]);
  });

  it("行の途中から始まる長い単語も文字単位で切る", () => {
    expect(wrapText("ab cdefghij", 50, measure)).toEqual([
      "ab",
      "cdefg",
      "hij",
    ]);
  });

  it("日本語のように空白のない文字列も折り返す", () => {
    expect(wrapText("あいうえおかきく", 50, measure)).toEqual([
      "あいうえお",
      "かきく",
    ]);
  });

  it("幅が 0 以下なら折り返さない", () => {
    expect(wrapText("abcdefgh", 0, measure)).toEqual(["abcdefgh"]);
  });

  it("行数の上限を超えないよう打ち切れる", () => {
    expect(wrapText("abcdefghij", 20, measure, 2)).toEqual(["ab", "cd"]);
  });
});
