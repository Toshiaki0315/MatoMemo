/**
 * BMP (Windows Bitmap) のデコーダ。
 *
 * 要件で BMP の読み込みが求められているが、WKWebView の `<img>` による
 * BMP 対応は環境依存で確実とは言えない。ヘッダ構造が単純な形式なので
 * 自前でデコードし、どの環境でも同じ結果になるようにしている。
 *
 * 対応範囲は実際に流通している非圧縮 BMP に絞る。
 *   - BITMAPINFOHEADER (40 バイト) 以降のヘッダ
 *   - 8 / 24 / 32 ビット、無圧縮 (BI_RGB)
 *   - ボトムアップ・トップダウンの両方の行順
 * これ以外は読めない理由を添えて例外にする。
 */

/** デコード結果。RGBA が 1 ピクセル 4 バイトで並ぶ。 */
export interface DecodedImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/** BMP を解釈できなかったことを表すエラー。 */
export class BmpDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BmpDecodeError";
  }
}

/** ファイルヘッダの長さ。 */
const FILE_HEADER_SIZE = 14;

/** BITMAPINFOHEADER の長さ。これより短いヘッダ (BITMAPCOREHEADER) は扱わない。 */
const MIN_DIB_HEADER_SIZE = 40;

/** 無圧縮を表す compression の値。 */
const BI_RGB = 0;

/** 対応するビット深度。 */
const SUPPORTED_BIT_COUNTS = [8, 24, 32];

/** BMP のバイト列を RGBA 画像にデコードする。 */
export function decodeBmp(bytes: Uint8Array): DecodedImage {
  if (bytes.length < FILE_HEADER_SIZE + MIN_DIB_HEADER_SIZE) {
    throw new BmpDecodeError("BMP ファイルとしては短すぎます。");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint8(0) !== 0x42 || view.getUint8(1) !== 0x4d) {
    throw new BmpDecodeError("BMP のシグネチャ (BM) がありません。");
  }

  const pixelOffset = view.getUint32(10, true);
  const dibHeaderSize = view.getUint32(14, true);
  if (dibHeaderSize < MIN_DIB_HEADER_SIZE) {
    throw new BmpDecodeError(
      `対応していない BMP ヘッダ形式です (ヘッダ長 ${dibHeaderSize})。`,
    );
  }

  const width = view.getInt32(18, true);
  const rawHeight = view.getInt32(22, true);
  const bitCount = view.getUint16(28, true);
  const compression = view.getUint32(30, true);

  if (width <= 0 || rawHeight === 0) {
    throw new BmpDecodeError("BMP の画像サイズが不正です。");
  }
  if (compression !== BI_RGB) {
    throw new BmpDecodeError(
      `圧縮された BMP には対応していません (compression=${compression})。`,
    );
  }
  if (!SUPPORTED_BIT_COUNTS.includes(bitCount)) {
    throw new BmpDecodeError(
      `対応していない色深度です (${bitCount} ビット)。8 / 24 / 32 ビットのみ読み込めます。`,
    );
  }

  // 高さが負なら行が上から下に並ぶ（トップダウン）
  const isTopDown = rawHeight < 0;
  const height = Math.abs(rawHeight);

  const palette =
    bitCount === 8
      ? readPalette(view, FILE_HEADER_SIZE + dibHeaderSize, view.getUint32(46, true))
      : null;

  // 各行は 4 バイト境界に揃えられる
  const rowSize = Math.floor((bitCount * width + 31) / 32) * 4;
  if (pixelOffset + rowSize * height > bytes.length) {
    throw new BmpDecodeError("BMP のピクセルデータが不足しています。");
  }

  const data = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const sourceRow = isTopDown ? row : height - 1 - row;
    const rowStart = pixelOffset + sourceRow * rowSize;
    for (let column = 0; column < width; column += 1) {
      const target = (row * width + column) * 4;
      writePixel(data, target, view, rowStart, column, bitCount, palette);
    }
  }

  return { width, height, data };
}

/**
 * パレット (BGRA が並ぶ) を RGBA に詰め直して返す。
 *
 * 256 色分を必ず確保し DataView として返す。添字アクセスではなく
 * `getUint8` で読むことで、範囲内なら必ず値が得られることを型の上でも
 * 表現でき、到達しない分岐を作らずに済む。
 */
function readPalette(
  view: DataView,
  offset: number,
  declaredCount: number,
): DataView {
  const count = declaredCount === 0 ? 256 : declaredCount;
  const palette = new Uint8Array(256 * 4);
  for (let index = 0; index < count; index += 1) {
    const entry = offset + index * 4;
    if (entry + 3 >= view.byteLength) {
      break;
    }
    palette[index * 4] = view.getUint8(entry + 2); // R
    palette[index * 4 + 1] = view.getUint8(entry + 1); // G
    palette[index * 4 + 2] = view.getUint8(entry); // B
    palette[index * 4 + 3] = 255;
  }
  return new DataView(palette.buffer);
}

/** 1 ピクセルを RGBA として書き込む。BMP のピクセルは BGR(A) 順に並ぶ。 */
function writePixel(
  data: Uint8ClampedArray,
  target: number,
  view: DataView,
  rowStart: number,
  column: number,
  bitCount: number,
  palette: DataView | null,
): void {
  if (palette !== null) {
    const index = view.getUint8(rowStart + column) * 4;
    data[target] = palette.getUint8(index);
    data[target + 1] = palette.getUint8(index + 1);
    data[target + 2] = palette.getUint8(index + 2);
    data[target + 3] = 255;
    return;
  }

  const bytesPerPixel = bitCount / 8;
  const source = rowStart + column * bytesPerPixel;
  data[target] = view.getUint8(source + 2); // R
  data[target + 1] = view.getUint8(source + 1); // G
  data[target + 2] = view.getUint8(source); // B
  // 32 ビットでもアルファが 0 で埋められたファイルが多いため、
  // 透過は解釈せず常に不透明として扱う
  data[target + 3] = 255;
}
