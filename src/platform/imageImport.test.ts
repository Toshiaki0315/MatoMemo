import { describe, expect, it, vi } from "vitest";
import { ImageImportError, importImageBytes } from "./imageImport";

/** 24 ビット 1x1 の最小 BMP。 */
function tinyBmp(): Uint8Array {
  const bytes = new Uint8Array(58);
  const view = new DataView(bytes.buffer);
  bytes[0] = 0x42;
  bytes[1] = 0x4d;
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, 1, true);
  view.setInt32(22, 1, true);
  view.setUint16(28, 24, true);
  // BGR = 青
  bytes[54] = 0xff;
  return bytes;
}

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02,
]);

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x01]);

describe("importImageBytes: PNG / JPEG", () => {
  it("PNG をそのまま data URL に埋め込む", async () => {
    const measure = vi.fn().mockResolvedValue({ width: 64, height: 32 });
    const result = await importImageBytes(PNG_BYTES, { measure });
    expect(result.source.startsWith("data:image/png;base64,")).toBe(true);
    expect(result).toMatchObject({ naturalWidth: 64, naturalHeight: 32 });
  });

  it("JPEG も同様に埋め込む", async () => {
    const measure = vi.fn().mockResolvedValue({ width: 10, height: 10 });
    const result = await importImageBytes(JPEG_BYTES, { measure });
    expect(result.source.startsWith("data:image/jpeg;base64,")).toBe(true);
  });

  it("原寸の測定に data URL を渡す", async () => {
    const measure = vi.fn().mockResolvedValue({ width: 1, height: 1 });
    const result = await importImageBytes(PNG_BYTES, { measure });
    expect(measure).toHaveBeenCalledWith(result.source);
  });
});

describe("importImageBytes: BMP", () => {
  it("デコードして PNG に変換する", async () => {
    const encode = vi.fn().mockReturnValue("data:image/png;base64,CONVERTED");
    const result = await importImageBytes(tinyBmp(), { encode });
    expect(result.source).toBe("data:image/png;base64,CONVERTED");
    expect(result).toMatchObject({ naturalWidth: 1, naturalHeight: 1 });
  });

  it("デコード結果を変換関数に渡す", async () => {
    const encode = vi.fn().mockReturnValue("data:image/png;base64,X");
    await importImageBytes(tinyBmp(), { encode });
    const decoded = encode.mock.calls[0]?.[0];
    expect(decoded).toMatchObject({ width: 1, height: 1 });
    // BGR の青が RGBA に並べ替えられている
    expect([...(decoded.data as Uint8ClampedArray)]).toEqual([0, 0, 255, 255]);
  });

  it("原寸の測定は行わない（デコード結果から分かるため）", async () => {
    const measure = vi.fn();
    await importImageBytes(tinyBmp(), {
      encode: () => "data:image/png;base64,X",
      measure,
    });
    expect(measure).not.toHaveBeenCalled();
  });

  it("壊れた BMP はデコードエラーになる", async () => {
    const broken = tinyBmp();
    new DataView(broken.buffer).setUint16(28, 16, true);
    await expect(
      importImageBytes(broken, { encode: () => "x" }),
    ).rejects.toThrow(/色深度/);
  });
});

describe("importImageBytes: 既定の変換手段", () => {
  it("encode を渡さなければ Canvas で PNG に変換する", async () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToDataUrl = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      putImageData: vi.fn(),
    })) as unknown as typeof originalGetContext;
    HTMLCanvasElement.prototype.toDataURL = vi.fn(
      () => "data:image/png;base64,DEFAULT",
    ) as unknown as typeof originalToDataUrl;

    await expect(importImageBytes(tinyBmp())).resolves.toMatchObject({
      source: "data:image/png;base64,DEFAULT",
    });

    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toDataURL = originalToDataUrl;
  });

  it("measure を渡さなければ Image 要素で原寸を測る", async () => {
    const promise = importImageBytes(PNG_BYTES);
    const image = lastCreatedImage();
    Object.defineProperty(image, "naturalWidth", { value: 33 });
    Object.defineProperty(image, "naturalHeight", { value: 44 });
    image.dispatchEvent(new Event("load"));
    await expect(promise).resolves.toMatchObject({
      naturalWidth: 33,
      naturalHeight: 44,
    });
  });
});

describe("importImageBytes: 未対応形式", () => {
  it("判定できない形式は拒否する", async () => {
    await expect(
      importImageBytes(new Uint8Array([0, 1, 2, 3])),
    ).rejects.toThrow(ImageImportError);
    await expect(
      importImageBytes(new Uint8Array([0, 1, 2, 3])),
    ).rejects.toThrow(/PNG \/ JPEG \/ BMP/);
  });
});

describe("encodeToPngDataUrl", () => {
  it("Canvas が使えない場合はエラーにする", async () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null,
    ) as unknown as typeof original;
    const { encodeToPngDataUrl } = await import("./imageImport");
    expect(() =>
      encodeToPngDataUrl({
        width: 1,
        height: 1,
        data: new Uint8ClampedArray(4),
      }),
    ).toThrow(ImageImportError);
    HTMLCanvasElement.prototype.getContext = original;
  });

  it("Canvas に描いて PNG の data URL を返す", async () => {
    const putImageData = vi.fn();
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToDataUrl = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      putImageData,
    })) as unknown as typeof originalGetContext;
    HTMLCanvasElement.prototype.toDataURL = vi.fn(
      () => "data:image/png;base64,OK",
    ) as unknown as typeof originalToDataUrl;

    const { encodeToPngDataUrl } = await import("./imageImport");
    expect(
      encodeToPngDataUrl({
        width: 2,
        height: 1,
        data: new Uint8ClampedArray(8),
      }),
    ).toBe("data:image/png;base64,OK");
    expect(putImageData).toHaveBeenCalled();

    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toDataURL = originalToDataUrl;
  });
});

describe("measureImageSize", () => {
  it("読み込み成功時に原寸を返す", async () => {
    const { measureImageSize } = await import("./imageImport");
    const promise = measureImageSize("data:image/png;base64,AA");
    // jsdom は実際に画像を読み込まないため load を手動で発火させる
    const image = lastCreatedImage();
    Object.defineProperty(image, "naturalWidth", { value: 120 });
    Object.defineProperty(image, "naturalHeight", { value: 80 });
    image.dispatchEvent(new Event("load"));
    await expect(promise).resolves.toEqual({ width: 120, height: 80 });
  });

  it("読み込み失敗時はエラーにする", async () => {
    const { measureImageSize } = await import("./imageImport");
    const promise = measureImageSize("data:image/png;base64,AA");
    lastCreatedImage().dispatchEvent(new Event("error"));
    await expect(promise).rejects.toThrow(ImageImportError);
  });
});

/** 直近に生成された Image 要素。 */
let created: HTMLImageElement[] = [];
const OriginalImage = globalThis.Image;
globalThis.Image = class extends OriginalImage {
  constructor() {
    super();
    created.push(this as unknown as HTMLImageElement);
  }
} as unknown as typeof Image;

function lastCreatedImage(): HTMLImageElement {
  const image = created.at(-1);
  if (image === undefined) {
    throw new Error("Image が生成されていません");
  }
  created = [];
  return image;
}
