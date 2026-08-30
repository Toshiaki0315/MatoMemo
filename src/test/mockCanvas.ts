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
  /** 呼び出されたメソッドと描画状態の代入の記録（順序どおり）。 */
  readonly calls: RecordedCall[];
  /** 指定したメソッドの呼び出しだけを取り出す。 */
  callsOf(method: string): RecordedCall[];
  /**
   * 指定したプロパティに代入された値を順に取り出す。
   *
   * 描画は「色を設定してから描く」の繰り返しなので、最終的な値だけでは
   * 途中で何色で描いたかが分からない。代入も記録して順序で検証できるようにする。
   */
  assignmentsTo(property: string): unknown[];
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
  "arcTo",
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

/** 記録の対象にする描画状態のプロパティと初期値。 */
const RECORDED_PROPERTIES: Record<string, unknown> = {
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 1,
  lineCap: "butt",
  lineJoin: "miter",
  font: "",
  textAlign: "start",
  textBaseline: "alphabetic",
  globalAlpha: 1,
};

export function createMockContext(): MockContext {
  const calls: RecordedCall[] = [];
  const values = new Map<string, unknown>(Object.entries(RECORDED_PROPERTIES));
  const target: Record<string, unknown> = {
    measureText: vi.fn(() => ({ width: 0 })),
  };

  for (const property of Object.keys(RECORDED_PROPERTIES)) {
    Object.defineProperty(target, property, {
      get: () => values.get(property),
      set: (value: unknown) => {
        values.set(property, value);
        calls.push({ method: `set:${property}`, args: [value] });
      },
      enumerable: true,
    });
  }

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
    assignmentsTo(property: string) {
      return calls
        .filter((call) => call.method === `set:${property}`)
        .map((call) => call.args[0]);
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
