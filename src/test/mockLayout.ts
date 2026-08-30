/**
 * テスト用のレイアウト関連スタブ。
 *
 * jsdom はレイアウトを行わないため `getBoundingClientRect` は常に 0 を返し、
 * `ResizeObserver` は実装されていない。要素サイズに依存するコンポーネントの
 * テストのために、どちらも制御可能なスタブに差し替える。
 */

import { vi } from "vitest";

type ResizeCallback = (
  entries: ResizeObserverEntry[],
  observer: ResizeObserver,
) => void;

export interface LayoutStub {
  /** スタブが報告する要素サイズ。テスト中に変更できる。 */
  size: { width: number; height: number };
  /** 監視中のすべてのコールバックを発火させる。 */
  triggerResize(size?: { width: number; height: number }): void;
  restore(): void;
}

/**
 * `getBoundingClientRect` と `ResizeObserver` をスタブに差し替える。
 * 返り値の `restore` で元に戻す。
 */
export function stubLayout(
  initialSize: { width: number; height: number } = { width: 800, height: 600 },
): LayoutStub {
  const callbacks = new Set<ResizeCallback>();
  const state = { size: { ...initialSize } };

  const originalGetRect = Element.prototype.getBoundingClientRect;
  const originalResizeObserver = globalThis.ResizeObserver as
    | typeof ResizeObserver
    | undefined;

  Element.prototype.getBoundingClientRect = vi.fn(function (): DOMRect {
    const { width, height } = state.size;
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({}),
    } as DOMRect;
  });

  class StubResizeObserver implements ResizeObserver {
    constructor(private readonly callback: ResizeCallback) {
      callbacks.add(callback);
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {
      callbacks.delete(this.callback);
    }
  }

  globalThis.ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver;

  return {
    get size() {
      return state.size;
    },
    set size(value) {
      state.size = value;
    },
    triggerResize(size) {
      if (size !== undefined) {
        state.size = size;
      }
      for (const callback of callbacks) {
        callback([], {} as ResizeObserver);
      }
    },
    restore() {
      Element.prototype.getBoundingClientRect = originalGetRect;
      if (originalResizeObserver === undefined) {
        Reflect.deleteProperty(globalThis, "ResizeObserver");
      } else {
        globalThis.ResizeObserver = originalResizeObserver;
      }
      callbacks.clear();
    },
  };
}
