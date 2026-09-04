/**
 * 画像ファイルの取り込み。
 *
 * 読み込んだバイト列を、ボードに埋め込める data URL に変換する。
 * BMP は WKWebView の `<img>` が確実に扱えるとは限らないため、自前で
 * デコードしてから PNG に変換し直す。PNG / JPEG はそのまま埋め込む。
 *
 * ボードは 1 つの JSON ファイルとして完結させたいので、外部ファイルへの
 * 参照ではなく画像の実体を data URL として埋め込む方針にしている。
 */

import { decodeBmp } from "../domain/image/bmp";
import {
  IMAGE_MIME_TYPES,
  detectImageFormat,
  toDataUrl,
} from "../domain/image/imageFormat";

/** 取り込んだ画像。 */
export interface ImportedImage {
  /** data URL。ボードにそのまま保存する。 */
  readonly source: string;
  readonly naturalWidth: number;
  readonly naturalHeight: number;
}

/** 画像を取り込めなかったことを表すエラー。 */
export class ImageImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageImportError";
  }
}

/** RGBA のピクセル列を PNG の data URL に変換する手段。 */
export type RasterEncoder = (image: {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}) => string;

/**
 * ブラウザの Canvas を使って PNG の data URL を作る。
 * テストでは差し替えられるよう引数で受け取れるようにしている。
 */
export const encodeToPngDataUrl: RasterEncoder = (image) => {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    throw new ImageImportError("画像を変換できませんでした。");
  }
  ctx.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
  return canvas.toDataURL("image/png");
};

/** PNG / JPEG の data URL から原寸を測る手段。 */
export type SizeMeasurer = (source: string) => Promise<{
  readonly width: number;
  readonly height: number;
}>;

/** `<img>` に読み込ませて原寸を得る。 */
export const measureImageSize: SizeMeasurer = (source) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    });
    image.addEventListener("error", () => {
      reject(new ImageImportError("画像を読み込めませんでした。"));
    });
    image.src = source;
  });

export interface ImportImageOptions {
  readonly encode?: RasterEncoder;
  readonly measure?: SizeMeasurer;
}

/** 画像ファイルのバイト列を、ボードに埋め込める形に変換する。 */
export async function importImageBytes(
  bytes: Uint8Array,
  options: ImportImageOptions = {},
): Promise<ImportedImage> {
  const format = detectImageFormat(bytes);
  if (format === null) {
    throw new ImageImportError(
      "対応していない画像形式です。PNG / JPEG / BMP のいずれかを選んでください。",
    );
  }

  if (format === "bmp") {
    const decoded = decodeBmp(bytes);
    const encode = options.encode ?? encodeToPngDataUrl;
    return {
      source: encode(decoded),
      naturalWidth: decoded.width,
      naturalHeight: decoded.height,
    };
  }

  const source = toDataUrl(bytes, IMAGE_MIME_TYPES[format]);
  const measure = options.measure ?? measureImageSize;
  const size = await measure(source);
  return {
    source,
    naturalWidth: size.width,
    naturalHeight: size.height,
  };
}

/**
 * ドロップされた `File` を取り込む。
 *
 * 経路が違うだけで中身の扱いは同じなので、バイト列にしてから
 * `importImageBytes` に渡す。対応していない形式ならここで弾かれる。
 */
export async function importImageFile(
  file: File,
  options: ImportImageOptions = {},
): Promise<ImportedImage> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return importImageBytes(bytes, options);
}
