/**
 * アイテム内のテキストの折り返し計算。
 *
 * 文字幅の測定は関数として受け取り、Canvas に依存しない純関数にしている。
 * これにより折り返しの規則を Canvas なしでテストできる。
 */

/** 文字列の描画幅を返す関数。 */
export type MeasureText = (text: string) => number;

/**
 * テキストを指定幅に収まるよう折り返す。
 *
 * 空白がある場合は単語の途中で切らないが、1 単語が幅に収まらない場合は
 * 文字単位で切る。日本語のように空白のない文字列も同じ経路で処理される。
 *
 * @param maxWidth 折り返し幅。0 以下なら折り返さない
 * @param maxLines 返す行数の上限。超えた分は捨てる
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: MeasureText,
  maxLines = Number.POSITIVE_INFINITY,
): string[] {
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    if (maxWidth <= 0) {
      lines.push(paragraph);
      continue;
    }
    lines.push(...wrapParagraph(paragraph, maxWidth, measure));
    if (lines.length >= maxLines) {
      break;
    }
  }

  return lines.slice(0, maxLines);
}

/** 改行を含まない 1 段落を折り返す。 */
function wrapParagraph(
  paragraph: string,
  maxWidth: number,
  measure: MeasureText,
): string[] {
  if (paragraph === "" || measure(paragraph) <= maxWidth) {
    return [paragraph];
  }

  const lines: string[] = [];
  let current = "";

  for (const word of paragraph.split(" ")) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }

    // この単語は現在の行に入らないので行を確定する
    if (current !== "") {
      lines.push(current);
      current = "";
    }

    if (measure(word) <= maxWidth) {
      current = word;
      continue;
    }

    // 単語 1 つで 1 行に収まらない場合だけ文字単位で切る。
    // 空白のない日本語の文章もここを通る。
    current = breakIntoLines(word, maxWidth, measure, lines);
  }

  lines.push(current);
  return lines;
}

/**
 * 1 行に収まらない文字列を文字単位で切り、確定した行を `lines` に積む。
 * @returns まだ確定していない末尾の行
 */
function breakIntoLines(
  word: string,
  maxWidth: number,
  measure: MeasureText,
  lines: string[],
): string {
  let chunk = "";
  for (const char of word) {
    if (chunk !== "" && measure(chunk + char) > maxWidth) {
      lines.push(chunk);
      chunk = char;
    } else {
      chunk += char;
    }
  }
  return chunk;
}
