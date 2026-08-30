/**
 * テスト用の Canvas 2D コンテキストのモック。
 *
 * jsdom は `HTMLCanvasElement.getContext` を実装していないため、描画処理の
 * テストでは本物の Canvas を使えない。ここでは呼び出しを記録するだけの
 * 軽量なスタブを用意し、「何をどの順で描いたか」を検証できるようにする。
 */

import { vi } from "vitest";

export interface RecordedCall {
  readonly method: string;
  readonly args: readonly unknown[];
}

export interface MockContext {
  readonly ctx: CanvasRenderingContext2D;
  /** 呼び出されたメソッドの記録（呼び出し順）。 */
  readonly calls: RecordedCall[];
  /** 指定したメソッドの呼び出しだけを取り出す。 */
  callsOf(method: string): RecordedCall[];
}

/** 記録の対象にする Canvas 2D のメソッド。 */
const RECORDED_METHODS = [
  "save",
  "restore",
  "setTransform",
  "resetTransform",
  "scale",
  "translate",
  "clearRect",
  "fillRect",
  "strokeRect",
  "beginPath",
  "closePath",
  "moveTo",
  "lineTo",
  "arc",
  "ellipse",
  "bezierCurveTo",
  "quadraticCurveTo",
  "roundRect",
  "rect",
  "fill",
  "stroke",
  "clip",
  "fillText",
  "strokeText",
  "drawImage",
] as const;

export function createMockContext(): MockContext {
  const calls: RecordedCall[] = [];
  const target: Record<string, unknown> = {
    // 描画状態のプロパティ。代入されるだけで参照はしない。
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    measureText: vi.fn(() => ({ width: 0 })),
  };

  for (const method of RECORDED_METHODS) {
    target[method] = vi.fn((...args: unknown[]) => {
      calls.push({ method, args });
    });
  }

  return {
    ctx: target as unknown as CanvasRenderingContext2D,
    calls,
    callsOf(method: string) {
      return calls.filter((call) => call.method === method);
    },
  };
}

/**
 * `HTMLCanvasElement.getContext` がモックコンテキストを返すようにする。
 * 返り値の `restore` で元に戻す。
 */
export function stubCanvasContext(): {
  readonly mock: MockContext;
  restore(): void;
} {
  const mock = createMockContext();
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => mock.ctx,
  ) as unknown as typeof original;
  return {
    mock,
    restore() {
      HTMLCanvasElement.prototype.getContext = original;
    },
  };
}
