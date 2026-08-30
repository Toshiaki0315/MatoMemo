import { useCallback, useState } from "react";
import {
  createViewport,
  clampScale,
  zoomAt,
  type Viewport,
} from "../domain/viewport";
import { BoardCanvas } from "./BoardCanvas";

/** ズームボタン 1 回あたりの倍率。 */
const ZOOM_STEP = 1.25;

export function App() {
  const [viewport, setViewport] = useState<Viewport>(createViewport);

  /** 画面中央を基準にズームする（ボタン操作用）。 */
  const zoomFromCenter = useCallback((factor: number) => {
    setViewport((current) =>
      zoomAt(
        current,
        { x: window.innerWidth / 2, y: window.innerHeight / 2 },
        factor,
      ),
    );
  }, []);

  const zoomPercent = Math.round(clampScale(viewport.scale) * 100);

  return (
    <main className="app">
      <BoardCanvas viewport={viewport} onViewportChange={setViewport} />
      <div className="zoom-controls">
        <button
          type="button"
          onClick={() => zoomFromCenter(1 / ZOOM_STEP)}
          aria-label="縮小"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setViewport(createViewport())}
          aria-label="表示倍率をリセット"
        >
          {zoomPercent}%
        </button>
        <button
          type="button"
          onClick={() => zoomFromCenter(ZOOM_STEP)}
          aria-label="拡大"
        >
          ＋
        </button>
      </div>
    </main>
  );
}
