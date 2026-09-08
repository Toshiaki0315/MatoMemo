/**
 * Canvas 2D API の呼び出しを SVG として記録するコンテキスト。
 *
 * ボードの描画ロジックは Canvas 用の `renderBoard` に一本化されている。
 * SVG 書き出しのために描画を二重に実装すると、図形を増やすたびに
 * 両方を直すことになり、見た目もずれていく。そこで Canvas と同じ
 * 呼び出しを受け取って SVG 要素を組み立てるこのコンテキストを差し込み、
 * 描画ロジックをそのまま流用する。
 *
 * 実装するのはこのアプリの描画が使う API のみ。文字幅の測定は
 * 本物の Canvas に委譲する（無い環境では概算で代用する）。
 */

import type { Point } from "../domain/geometry";

/** 文字幅の測定。本物の Canvas の measureText に委譲するための型。 */
export type MeasureTextWidth = (text: string, font: string) => number;

/** 変換行列 (Canvas の setTransform と同じ並び)。 */
interface Matrix {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** 描画スタイル。save/restore で退避・復元する。 */
interface DrawState {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  font: string;
  textAlign: string;
  textBaseline: string;
  globalAlpha: number;
  lineDash: readonly number[];
  transform: Matrix;
}

/**
 * フォントの一行 (`20px "Hiragino Sans", sans-serif` 形式) を分解する。
 * Canvas の top 基準の文字位置を SVG のベースライン基準に直すのにも使う。
 */
function parseFont(font: string): { size: number; family: string } {
  const match = /(\d+(?:\.\d+)?)px\s+(.*)$/.exec(font);
  return {
    size: match === null ? 16 : Number(match[1]),
    family: match?.[2] ?? "sans-serif",
  };
}

/**
 * Canvas の top ベースラインからアルファベットベースラインまでの距離の割合。
 * SVG の text はベースライン基準なので、この分だけ下げて描く。
 */
const ASCENT_RATIO = 0.8;

/** 文字幅の概算 (px)。測定手段が無い環境の予備。 */
function approximateWidth(text: string, font: string): number {
  const { size } = parseFont(font);
  let width = 0;
  for (const char of text) {
    // 全角をおおよそ 1em、半角を 0.55em とみなす
    width += char.charCodeAt(0) > 0xff ? size : size * 0.55;
  }
  return width;
}

/** XML に埋め込めるように特殊文字を落とす。 */
function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** 数値を短く整形する。SVG が無駄に長くならないように丸める。 */
function fmt(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export class SvgContext {
  // Canvas 2D と同じ名前のプロパティ（renderBoard がそのまま代入する）
  fillStyle = "#000000";
  strokeStyle = "#000000";
  lineWidth = 1;
  lineCap = "butt";
  lineJoin = "miter";
  font = "10px sans-serif";
  textAlign = "start";
  textBaseline = "alphabetic";
  globalAlpha = 1;

  private lineDash: readonly number[] = [];
  private transform: Matrix = IDENTITY;
  private readonly stack: DrawState[] = [];
  private path = "";
  private current: Point | null = null;
  private readonly elements: string[] = [];
  private readonly measure: MeasureTextWidth;

  constructor(measure: MeasureTextWidth = approximateWidth) {
    this.measure = measure;
  }

  save(): void {
    this.stack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      lineCap: this.lineCap,
      lineJoin: this.lineJoin,
      font: this.font,
      textAlign: this.textAlign,
      textBaseline: this.textBaseline,
      globalAlpha: this.globalAlpha,
      lineDash: this.lineDash,
      transform: this.transform,
    });
  }

  restore(): void {
    const state = this.stack.pop();
    if (state === undefined) {
      return;
    }
    this.fillStyle = state.fillStyle;
    this.strokeStyle = state.strokeStyle;
    this.lineWidth = state.lineWidth;
    this.lineCap = state.lineCap;
    this.lineJoin = state.lineJoin;
    this.font = state.font;
    this.textAlign = state.textAlign;
    this.textBaseline = state.textBaseline;
    this.globalAlpha = state.globalAlpha;
    this.lineDash = state.lineDash;
    this.transform = state.transform;
  }

  setTransform(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ): void {
    this.transform = { a, b, c, d, e, f };
  }

  setLineDash(segments: readonly number[]): void {
    this.lineDash = segments;
  }

  getLineDash(): number[] {
    return [...this.lineDash];
  }

  beginPath(): void {
    this.path = "";
    this.current = null;
  }

  closePath(): void {
    this.path += "Z";
  }

  moveTo(x: number, y: number): void {
    this.path += `M${fmt(x)} ${fmt(y)}`;
    this.current = { x, y };
  }

  lineTo(x: number, y: number): void {
    this.path += `L${fmt(x)} ${fmt(y)}`;
    this.current = { x, y };
  }

  bezierCurveTo(
    c1x: number,
    c1y: number,
    c2x: number,
    c2y: number,
    x: number,
    y: number,
  ): void {
    this.path += `C${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(x)} ${fmt(y)}`;
    this.current = { x, y };
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.moveTo(x, y);
    this.path += `h${fmt(width)}v${fmt(height)}h${fmt(-width)}Z`;
  }

  roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void {
    const r = Math.min(radius, width / 2, height / 2);
    const arc = (dx: number, dy: number) =>
      `a${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(dx)} ${fmt(dy)}`;
    this.moveTo(x + r, y);
    this.path +=
      `h${fmt(width - 2 * r)}${arc(r, r)}` +
      `v${fmt(height - 2 * r)}${arc(-r, r)}` +
      `h${fmt(-(width - 2 * r))}${arc(-r, -r)}` +
      `v${fmt(-(height - 2 * r))}${arc(r, -r)}Z`;
  }

  ellipse(
    cx: number,
    cy: number,
    radiusX: number,
    radiusY: number,
    _rotation: number,
    _startAngle: number,
    _endAngle: number,
  ): void {
    // このアプリでは常に一周だけ描くので、半周の弧 2 本で表す
    this.moveTo(cx - radiusX, cy);
    this.path +=
      `a${fmt(radiusX)} ${fmt(radiusY)} 0 1 0 ${fmt(radiusX * 2)} 0` +
      `a${fmt(radiusX)} ${fmt(radiusY)} 0 1 0 ${fmt(-radiusX * 2)} 0Z`;
  }

  arc(
    cx: number,
    cy: number,
    radius: number,
    startAngle: number,
    endAngle: number,
  ): void {
    this.ellipse(cx, cy, radius, radius, 0, startAngle, endAngle);
  }

  /**
   * 現在位置から角 (x1, y1) を経て (x2, y2) へ向かう角を radius で丸める。
   * 折れ線の角の丸みに使われる。Canvas と同じく、接点まで直線を引いてから
   * 円弧を挟む。
   */
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void {
    const from = this.current;
    if (from === null) {
      this.moveTo(x1, y1);
      return;
    }
    const v1 = { x: from.x - x1, y: from.y - y1 };
    const v2 = { x: x2 - x1, y: y2 - y1 };
    const length1 = Math.hypot(v1.x, v1.y);
    const length2 = Math.hypot(v2.x, v2.y);
    const cross = v1.x * v2.y - v1.y * v2.x;
    // 一直線上（または長さ 0）のときは Canvas と同じく角まで直線を引く
    if (radius <= 0 || length1 === 0 || length2 === 0 || cross === 0) {
      this.lineTo(x1, y1);
      return;
    }
    const unit1 = { x: v1.x / length1, y: v1.y / length1 };
    const unit2 = { x: v2.x / length2, y: v2.y / length2 };
    // 接点は角から (半径 / tan(θ/2)) だけ手前
    const angle = Math.acos(
      Math.max(-1, Math.min(1, unit1.x * unit2.x + unit1.y * unit2.y)),
    );
    const distance = radius / Math.tan(angle / 2);
    const start = { x: x1 + unit1.x * distance, y: y1 + unit1.y * distance };
    const end = { x: x1 + unit2.x * distance, y: y1 + unit2.y * distance };
    const sweep = cross < 0 ? 1 : 0;
    this.lineTo(start.x, start.y);
    this.path += `A${fmt(radius)} ${fmt(radius)} 0 0 ${sweep} ${fmt(end.x)} ${fmt(end.y)}`;
    this.current = end;
  }

  fill(): void {
    this.elements.push(
      `<path d="${this.path}" fill="${this.fillStyle}"${this.commonAttributes()} />`,
    );
  }

  stroke(): void {
    const dash =
      this.lineDash.length > 0
        ? ` stroke-dasharray="${this.lineDash.map(fmt).join(" ")}"`
        : "";
    this.elements.push(
      `<path d="${this.path}" fill="none" stroke="${this.strokeStyle}" ` +
        `stroke-width="${fmt(this.lineWidth)}" stroke-linecap="${this.lineCap}" ` +
        `stroke-linejoin="${this.lineJoin}"${dash}${this.commonAttributes()} />`,
    );
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    this.elements.push(
      `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(width)}" height="${fmt(height)}" ` +
        `fill="${this.fillStyle}"${this.commonAttributes()} />`,
    );
  }

  fillText(text: string, x: number, y: number): void {
    const { size, family } = parseFont(this.font);
    // Canvas は top 基準で描いているので、ベースライン基準の SVG では下げる
    const baselineY = this.textBaseline === "top" ? y + size * ASCENT_RATIO : y;
    const anchor =
      this.textAlign === "center"
        ? "middle"
        : this.textAlign === "right"
          ? "end"
          : "start";
    this.elements.push(
      `<text x="${fmt(x)}" y="${fmt(baselineY)}" font-size="${fmt(size)}" ` +
        `font-family='${family}' text-anchor="${anchor}" fill="${this.fillStyle}"` +
        `${this.commonAttributes()}>${escapeXml(text)}</text>`,
    );
  }

  measureText(text: string): TextMetrics {
    return { width: this.measure(text, this.font) } as TextMetrics;
  }

  drawImage(
    image: CanvasImageSource,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    // 画像アイテムは data URL を持つ HTMLImageElement として渡される
    const source = (image as { src?: string }).src;
    if (source === undefined) {
      return;
    }
    this.elements.push(
      `<image x="${fmt(x)}" y="${fmt(y)}" width="${fmt(width)}" height="${fmt(height)}" ` +
        `href="${escapeXml(source)}" preserveAspectRatio="none"${this.commonAttributes()} />`,
    );
  }

  /** 変換と透明度の属性。既定値のときは何も出さない。 */
  private commonAttributes(): string {
    const { a, b, c, d, e, f } = this.transform;
    const isIdentity =
      a === 1 && b === 0 && c === 0 && d === 1 && e === 0 && f === 0;
    const transform = isIdentity
      ? ""
      : ` transform="matrix(${[a, b, c, d, e, f].map(fmt).join(" ")})"`;
    const opacity =
      this.globalAlpha === 1 ? "" : ` opacity="${fmt(this.globalAlpha)}"`;
    return `${transform}${opacity}`;
  }

  /** 記録した内容を SVG 文書として組み立てる。 */
  toSvg(width: number, height: number): string {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}" ` +
      `height="${fmt(height)}" viewBox="0 0 ${fmt(width)} ${fmt(height)}">\n` +
      this.elements.join("\n") +
      "\n</svg>\n"
    );
  }
}
