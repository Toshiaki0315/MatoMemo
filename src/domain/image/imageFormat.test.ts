import { describe, expect, it } from "vitest";
import {
  IMAGE_MIME_TYPES,
  detectImageFormat,
  toBase64,
  toDataUrl,
} from "./imageFormat";

describe("detectImageFormat", () => {
  it("PNG を判定する", () => {
    expect(
      detectImageFormat(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
      ),
    ).toBe("png");
  });

  it("JPEG を判定する", () => {
    expect(detectImageFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "jpeg",
    );
  });

  it("BMP を判定する", () => {
    expect(detectImageFormat(new Uint8Array([0x42, 0x4d, 0x00, 0x00]))).toBe(
      "bmp",
    );
  });

  it("未知の形式は null を返す", () => {
    expect(detectImageFormat(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toBeNull();
  });

  it("短すぎるデータは null を返す", () => {
    expect(detectImageFormat(new Uint8Array([0x89]))).toBeNull();
    expect(detectImageFormat(new Uint8Array())).toBeNull();
  });

  it("シグネチャが途中で違えば別形式と判定しない", () => {
    expect(
      detectImageFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x00, 0, 0, 0, 0])),
    ).toBeNull();
  });
});

describe("IMAGE_MIME_TYPES", () => {
  it("形式ごとの MIME タイプを持つ", () => {
    expect(IMAGE_MIME_TYPES.png).toBe("image/png");
    expect(IMAGE_MIME_TYPES.jpeg).toBe("image/jpeg");
    expect(IMAGE_MIME_TYPES.bmp).toBe("image/bmp");
  });
});

describe("toBase64", () => {
  it("バイト列を Base64 に変換する", () => {
    expect(toBase64(new Uint8Array([0x4d, 0x61, 0x6e]))).toBe("TWFu");
  });

  it("空のバイト列は空文字になる", () => {
    expect(toBase64(new Uint8Array())).toBe("");
  });

  it("分割の境界を越える大きさでも正しく変換する", () => {
    const bytes = new Uint8Array(0x8000 * 2 + 5).fill(0x41);
    expect(toBase64(bytes)).toBe(btoa("A".repeat(bytes.length)));
  });
});

describe("toDataUrl", () => {
  it("data URL を組み立てる", () => {
    expect(toDataUrl(new Uint8Array([0x4d, 0x61, 0x6e]), "image/png")).toBe(
      "data:image/png;base64,TWFu",
    );
  });
});
