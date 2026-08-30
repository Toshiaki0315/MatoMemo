/**
 * 画像ファイルの形式判定。
 *
 * 拡張子ではなく先頭バイト（マジックナンバー）で判定する。拡張子は
 * 容易に食い違うため、実際の中身に従うほうが確実なため。
 */

/** MatoMemo が読み込める画像形式。 */
export type ImageFormat = "png" | "jpeg" | "bmp";

/** 形式ごとの MIME タイプ。 */
export const IMAGE_MIME_TYPES: Record<ImageFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  bmp: "image/bmp",
};

/** 読み込みダイアログで許可する拡張子。 */
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "bmp"] as const;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const BMP_SIGNATURE = [0x42, 0x4d]; // "BM"

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) {
    return false;
  }
  return signature.every((value, index) => bytes[index] === value);
}

/** 先頭バイトから画像形式を判定する。判定できなければ null。 */
export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (startsWith(bytes, PNG_SIGNATURE)) {
    return "png";
  }
  if (startsWith(bytes, JPEG_SIGNATURE)) {
    return "jpeg";
  }
  if (startsWith(bytes, BMP_SIGNATURE)) {
    return "bmp";
  }
  return null;
}

/** バイト列を Base64 文字列に変換する。 */
export function toBase64(bytes: Uint8Array): string {
  // btoa は 1 文字 = 1 バイトの文字列を要求する。大きな画像で
  // スタックが溢れないよう分割して変換する。
  const CHUNK_SIZE = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/** バイト列を data URL に変換する。 */
export function toDataUrl(bytes: Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${toBase64(bytes)}`;
}
