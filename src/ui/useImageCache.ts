/**
 * 画像アイテムを描画可能な形に読み込んでおくためのフック。
 *
 * Canvas の `drawImage` には読み込み済みの画像が要る。data URL のままでは
 * 描けないため、アイテムごとに `HTMLImageElement` を用意して保持する。
 */

import { useEffect, useState } from "react";
import type { Item } from "../domain/board";
import type { ImageCache } from "../render/itemRenderer";

/** 画像アイテムを読み込み、id から引ける表を返す。 */
export function useImageCache(items: readonly Item[]): ImageCache {
  const [cache, setCache] = useState<ReadonlyMap<string, CanvasImageSource>>(
    new Map(),
  );

  useEffect(() => {
    const imageItems = items.filter((item) => item.type === "image");
    // 読み込みが終わる前にアイテムが消えた場合に備え、破棄フラグを持つ
    let disposed = false;

    for (const item of imageItems) {
      if (cache.has(item.id)) {
        continue;
      }
      const element = new Image();
      element.addEventListener("load", () => {
        if (disposed) {
          return;
        }
        setCache((current) => new Map(current).set(item.id, element));
      });
      element.src = item.source;
    }

    return () => {
      disposed = true;
    };
  }, [items, cache]);

  return cache;
}
