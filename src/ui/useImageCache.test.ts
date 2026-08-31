import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createImage, createStickyNote, type Item } from "../domain/board";
import { useImageCache } from "./useImageCache";

/** 生成された Image 要素を捕まえるための差し替え。 */
let created: HTMLImageElement[] = [];
const OriginalImage = globalThis.Image;

beforeEach(() => {
  created = [];
  globalThis.Image = class extends OriginalImage {
    constructor() {
      super();
      created.push(this as unknown as HTMLImageElement);
    }
  } as unknown as typeof Image;
});

afterEach(() => {
  globalThis.Image = OriginalImage;
});

function imageItem(id: string): Item {
  return createImage({
    id,
    x: 0,
    y: 0,
    source: `data:image/png;base64,${id}`,
    naturalWidth: 10,
    naturalHeight: 10,
  });
}

describe("useImageCache", () => {
  it("画像アイテムがなければ空のまま", () => {
    const { result } = renderHook(() =>
      useImageCache([createStickyNote({ id: "s", x: 0, y: 0 })]),
    );
    expect(result.current.size).toBe(0);
    expect(created).toHaveLength(0);
  });

  it("画像アイテムを読み込む", () => {
    const { result } = renderHook(() => useImageCache([imageItem("img")]));
    expect(created).toHaveLength(1);
    expect(created[0]?.src).toBe("data:image/png;base64,img");

    act(() => {
      created[0]?.dispatchEvent(new Event("load"));
    });
    expect(result.current.get("img")).toBe(created[0]);
  });

  it("読み込み済みの画像を読み直さない", () => {
    const items = [imageItem("img")];
    const { rerender } = renderHook(({ list }) => useImageCache(list), {
      initialProps: { list: items },
    });
    act(() => {
      created[0]?.dispatchEvent(new Event("load"));
    });
    rerender({ list: [...items] });
    expect(created).toHaveLength(1);
  });

  it("複数の画像を読み込む", () => {
    const { result } = renderHook(() =>
      useImageCache([imageItem("a"), imageItem("b")]),
    );
    act(() => {
      for (const element of created) {
        element.dispatchEvent(new Event("load"));
      }
    });
    expect(result.current.size).toBe(2);
  });

  it("ボードから消えた画像はキャッシュから捨てる", () => {
    const { result, rerender } = renderHook(({ list }) => useImageCache(list), {
      initialProps: { list: [imageItem("a"), imageItem("b")] },
    });
    act(() => {
      for (const element of created) {
        element.dispatchEvent(new Event("load"));
      }
    });
    expect(result.current.size).toBe(2);

    rerender({ list: [imageItem("a")] });
    expect(result.current.size).toBe(1);
    expect(result.current.get("a")).toBe(created[0]);
  });

  it("消えた画像が戻ってきたら読み込み直す", () => {
    // 削除の取り消しで同じ id が戻ってくる場合。開始の記録も
    // 消しておかないと、二度と読み込まれない
    const { rerender } = renderHook(({ list }) => useImageCache(list), {
      initialProps: { list: [imageItem("a")] },
    });
    act(() => {
      created[0]?.dispatchEvent(new Event("load"));
    });
    rerender({ list: [] });
    rerender({ list: [imageItem("a")] });
    expect(created).toHaveLength(2);
  });

  it("読み込みが終わる前に消えてもキャッシュの参照は変えない", () => {
    // まだ何も入っていないので捨てるものが無い。ここで新しい Map を
    // 返すと、描画のたびに無駄な再描画が起きる
    const { result, rerender } = renderHook(({ list }) => useImageCache(list), {
      initialProps: { list: [imageItem("a")] },
    });
    const before = result.current;
    rerender({ list: [] });
    expect(result.current).toBe(before);
  });

  it("消えた画像の読み込みが後から完了しても取り込まない", () => {
    const { result, rerender } = renderHook(({ list }) => useImageCache(list), {
      initialProps: { list: [imageItem("a")] },
    });
    rerender({ list: [] });
    act(() => {
      created[0]?.dispatchEvent(new Event("load"));
    });
    expect(result.current.size).toBe(0);
  });

  it("アンマウント後の読み込み完了は無視する", () => {
    const { result, unmount } = renderHook(() =>
      useImageCache([imageItem("img")]),
    );
    unmount();
    act(() => {
      created[0]?.dispatchEvent(new Event("load"));
    });
    expect(result.current.size).toBe(0);
  });
});
