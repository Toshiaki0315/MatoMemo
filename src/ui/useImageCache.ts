/**
 * 画像アイテムを描画可能な形に読み込んでおくためのフック。
 *
 * Canvas の `drawImage` には読み込み済みの画像が要る。data URL のままでは
 * 描けないため、アイテムごとに `HTMLImageElement` を用意して保持する。
 */

import { useEffect, useRef, useState } from "react";
import type { Item } from "../domain/board";
import type { ImageCache } from "../render/itemRenderer";

/** 画像アイテムを読み込み、id から引ける表を返す。 */
export function useImageCache(items: readonly Item[]): ImageCache {
  const [cache, setCache] = useState<ReadonlyMap<string, CanvasImageSource>>(
    new Map(),
  );
  /**
   * 読み込みを始めた（結果待ちを含む）アイテムの id。
   *
   * `items` はボードのどんな変更でも新しい配列になるため、cache だけを
   * 見て判断すると、読み込み完了前の再実行のたびに同じ画像を読み直して
   * しまう。読み込み失敗も再試行しないよう、開始した時点で記録する。
   */
  const requested = useRef(new Set<string>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const imageItems = items.filter((item) => item.type === "image");
    const alive = new Set(imageItems.map((item) => item.id));

    // ボードから消えたアイテムの分は捨てる。同じ id が戻ってきたら
    // （取り消しなど）読み込み直せるよう、開始の記録も消す。
    let hasStale = false;
    for (const id of requested.current) {
      if (!alive.has(id)) {
        requested.current.delete(id);
        hasStale = true;
      }
    }
    if (hasStale) {
      setCache((current) => {
        const next = new Map(
          [...current].filter(([id]) => alive.has(id)),
        );
        return next.size === current.size ? current : next;
      });
    }

    for (const item of imageItems) {
      if (requested.current.has(item.id)) {
        continue;
      }
      requested.current.add(item.id);
      const element = new Image();
      element.addEventListener("load", () => {
        // 完了までにアイテムが消えた・フックが破棄された場合は反映しない
        if (!mounted.current || !requested.current.has(item.id)) {
          return;
        }
        setCache((current) => new Map(current).set(item.id, element));
      });
      // 失敗した画像は枠のみの表示のままにする。記録は残っているので、
      // 同じ壊れた source を延々と読み直すことはない。
      element.src = item.source;
    }
  }, [items]);

  return cache;
}
