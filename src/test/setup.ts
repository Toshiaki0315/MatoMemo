import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * jsdom は `PointerEvent` を実装していない。ポリフィルがないと Testing Library
 * が pointerdown 等を素の `Event` として送出し、`button` や `clientX` が
 * 伝わらないため、ポインタ操作のテストが書けなくなる。
 * `MouseEvent` を継承した最小限の実装を用意する。
 */
if (typeof globalThis.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;
    readonly width: number;
    readonly height: number;
    readonly pressure: number;
    readonly tangentialPressure: number;
    readonly tiltX: number;
    readonly tiltY: number;
    readonly twist: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0;
      this.tangentialPressure = params.tangentialPressure ?? 0;
      this.tiltX = params.tiltX ?? 0;
      this.tiltY = params.tiltY ?? 0;
      this.twist = params.twist ?? 0;
      this.pointerType = params.pointerType ?? "mouse";
      this.isPrimary = params.isPrimary ?? true;
    }

    getCoalescedEvents(): PointerEvent[] {
      return [];
    }

    getPredictedEvents(): PointerEvent[] {
      return [];
    }
  }

  globalThis.PointerEvent =
    PointerEventPolyfill as unknown as typeof PointerEvent;
}

/**
 * jsdom は `ImageData` も実装していない。BMP をデコードして Canvas に
 * 描き戻す処理のテストに必要なので、最小限の実装を用意する。
 */
if (typeof globalThis.ImageData === "undefined") {
  class ImageDataPolyfill {
    readonly data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;
    readonly colorSpace = "srgb" as const;

    constructor(data: Uint8ClampedArray, width: number, height?: number) {
      this.data = data;
      this.width = width;
      this.height = height ?? data.length / 4 / width;
    }
  }

  globalThis.ImageData = ImageDataPolyfill as unknown as typeof ImageData;
}

afterEach(() => {
  cleanup();
});
