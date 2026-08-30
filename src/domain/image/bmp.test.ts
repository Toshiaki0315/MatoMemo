import { describe, expect, it } from "vitest";
import { BmpDecodeError, decodeBmp } from "./bmp";

interface BuildOptions {
  readonly width: number;
  /** 負なら行がトップダウンに並ぶ。 */
  readonly height: number;
  readonly bitCount: number;
  /** 行ごとのピクセルバイト列（パディング前）。 */
  readonly rows: readonly (readonly number[])[];
  readonly compression?: number;
  /** 8 ビット時のパレット（BGRA の並び）。 */
  readonly palette?: readonly (readonly number[])[];
  /** ピクセルデータを意図的に切り詰める。 */
  readonly truncatePixels?: boolean;
}

/** テスト用に最小限の BMP を組み立てる。 */
function buildBmp(options: BuildOptions): Uint8Array {
  const dibHeaderSize = 40;
  const paletteBytes = (options.palette ?? []).flatMap((entry) => [...entry]);
  const pixelOffset = 14 + dibHeaderSize + paletteBytes.length;
  const rowSize = Math.floor((options.bitCount * options.width + 31) / 32) * 4;

  const pixels: number[] = [];
  for (const row of options.rows) {
    const padded = [...row];
    while (padded.length < rowSize) {
      padded.push(0);
    }
    pixels.push(...padded);
  }
  if (options.truncatePixels) {
    pixels.length = Math.max(0, pixels.length - rowSize);
  }

  const total = pixelOffset + pixels.length;
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);

  bytes[0] = 0x42;
  bytes[1] = 0x4d;
  view.setUint32(2, total, true);
  view.setUint32(10, pixelOffset, true);

  view.setUint32(14, dibHeaderSize, true);
  view.setInt32(18, options.width, true);
  view.setInt32(22, options.height, true);
  view.setUint16(26, 1, true); // planes
  view.setUint16(28, options.bitCount, true);
  view.setUint32(30, options.compression ?? 0, true);
  if (total >= 50) {
    view.setUint32(46, options.palette?.length ?? 0, true);
  }

  bytes.set(paletteBytes, 14 + dibHeaderSize);
  bytes.set(pixels, pixelOffset);
  return bytes;
}

/** 指定ピクセルの RGBA を取り出す。 */
function pixelAt(
  image: { width: number; data: Uint8ClampedArray },
  x: number,
  y: number,
): number[] {
  const offset = (y * image.width + x) * 4;
  return [...image.data.slice(offset, offset + 4)];
}

describe("decodeBmp: 24 ビット", () => {
  // BMP は BGR 順。1x2 の画像で、下の行が赤、上の行が青
  const bmp = buildBmp({
    width: 1,
    height: 2,
    bitCount: 24,
    rows: [
      [0x00, 0x00, 0xff], // ボトムアップなので最初の行が画像の下端 = 赤
      [0xff, 0x00, 0x00], // 青
    ],
  });

  it("サイズを読み取る", () => {
    const image = decodeBmp(bmp);
    expect(image.width).toBe(1);
    expect(image.height).toBe(2);
  });

  it("BGR を RGBA に並べ替える", () => {
    const image = decodeBmp(bmp);
    // ボトムアップなので、先頭の行が画像の一番下に来る
    expect(pixelAt(image, 0, 1)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(image, 0, 0)).toEqual([0, 0, 255, 255]);
  });

  it("行のパディングを読み飛ばす", () => {
    // 幅 3 の 24 ビットは 9 バイトだが、行は 12 バイトに揃えられる
    const image = decodeBmp(
      buildBmp({
        width: 3,
        height: 1,
        bitCount: 24,
        rows: [[1, 2, 3, 4, 5, 6, 7, 8, 9]],
      }),
    );
    expect(pixelAt(image, 0, 0)).toEqual([3, 2, 1, 255]);
    expect(pixelAt(image, 2, 0)).toEqual([9, 8, 7, 255]);
  });
});

describe("decodeBmp: 32 ビット", () => {
  it("BGRA を読み、常に不透明にする", () => {
    const image = decodeBmp(
      buildBmp({
        width: 1,
        height: 1,
        bitCount: 32,
        rows: [[0x10, 0x20, 0x30, 0x00]],
      }),
    );
    expect(pixelAt(image, 0, 0)).toEqual([0x30, 0x20, 0x10, 255]);
  });
});

describe("decodeBmp: 8 ビットパレット", () => {
  it("パレットの色に変換する", () => {
    const image = decodeBmp(
      buildBmp({
        width: 2,
        height: 1,
        bitCount: 8,
        // BGRA の並び
        palette: [
          [0x00, 0x00, 0xff, 0x00],
          [0x00, 0xff, 0x00, 0x00],
        ],
        rows: [[0, 1]],
      }),
    );
    expect(pixelAt(image, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(image, 1, 0)).toEqual([0, 255, 0, 255]);
  });

  it("パレット数が 0 なら 256 色として扱う", () => {
    const bmp = buildBmp({
      width: 1,
      height: 1,
      bitCount: 8,
      palette: [[0x11, 0x22, 0x33, 0x00]],
      rows: [[0]],
    });
    // clrUsed を 0 に書き換える
    new DataView(bmp.buffer).setUint32(46, 0, true);
    expect(pixelAt(decodeBmp(bmp), 0, 0)).toEqual([0x33, 0x22, 0x11, 255]);
  });
});

describe("decodeBmp: 行順", () => {
  it("高さが負ならトップダウンとして読む", () => {
    const image = decodeBmp(
      buildBmp({
        width: 1,
        height: -2,
        bitCount: 24,
        rows: [
          [0x00, 0x00, 0xff], // 赤（画像の上端）
          [0xff, 0x00, 0x00], // 青
        ],
      }),
    );
    expect(image.height).toBe(2);
    expect(pixelAt(image, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(image, 0, 1)).toEqual([0, 0, 255, 255]);
  });
});

describe("decodeBmp: エラー", () => {
  function expectError(bytes: Uint8Array, pattern: RegExp) {
    expect(() => decodeBmp(bytes)).toThrow(BmpDecodeError);
    expect(() => decodeBmp(bytes)).toThrow(pattern);
  }

  it("短すぎるデータを拒否する", () => {
    expectError(new Uint8Array(10), /短すぎ/);
  });

  it("シグネチャが違うデータを拒否する", () => {
    const bytes = new Uint8Array(60);
    bytes[0] = 0x00;
    expectError(bytes, /シグネチャ/);
  });

  it("古いヘッダ形式 (BITMAPCOREHEADER) を拒否する", () => {
    const bmp = buildBmp({
      width: 1,
      height: 1,
      bitCount: 24,
      rows: [[0, 0, 0]],
    });
    // ヘッダ長だけを BITMAPCOREHEADER の 12 に書き換える
    new DataView(bmp.buffer).setUint32(14, 12, true);
    expectError(bmp, /ヘッダ形式/);
  });

  it("圧縮された BMP を拒否する", () => {
    expectError(
      buildBmp({
        width: 1,
        height: 1,
        bitCount: 24,
        rows: [[0, 0, 0]],
        compression: 1,
      }),
      /圧縮/,
    );
  });

  it("対応していない色深度を拒否する", () => {
    expectError(
      buildBmp({ width: 1, height: 1, bitCount: 16, rows: [[0, 0]] }),
      /色深度/,
    );
  });

  it("サイズが 0 のものを拒否する", () => {
    expectError(
      buildBmp({ width: 0, height: 1, bitCount: 24, rows: [[]] }),
      /画像サイズ/,
    );
    expectError(
      buildBmp({ width: 1, height: 0, bitCount: 24, rows: [[]] }),
      /画像サイズ/,
    );
  });

  it("ピクセルデータが足りないものを拒否する", () => {
    expectError(
      buildBmp({
        width: 1,
        height: 2,
        bitCount: 24,
        rows: [
          [0, 0, 0],
          [0, 0, 0],
        ],
        truncatePixels: true,
      }),
      /ピクセルデータ/,
    );
  });

  it("パレットがファイル末尾で切れていても落ちない", () => {
    const bmp = buildBmp({
      width: 1,
      height: 1,
      bitCount: 8,
      palette: [[0x11, 0x22, 0x33, 0x00]],
      rows: [[0]],
    });
    // 実際には 1 色しかないのに 4 色あると宣言する
    new DataView(bmp.buffer).setUint32(46, 4, true);
    expect(() => decodeBmp(bmp)).not.toThrow();
  });
});
