/**
 * ホワイトボードのキャンバス。
 *
 * ビューポートは props で受け取る制御コンポーネントにしている。状態を内部に
 * 持たないことで、ズーム倍率の表示やツールバーなど外側の UI と齟齬なく
 * 同じ状態を共有できる。
 */

import { useEffect, useState } from "react";
import {
  panBy,
  zoomAt,
  type Viewport,
} from "../domain/viewport";
import { renderBoard, type CanvasTheme } from "../render/boardRenderer";

/**
 * ホイールの移動量をズーム倍率に変換する係数。
 * macOS のトラックパッドのピンチ操作は ctrlKey 付きの wheel として届く。
 */
const ZOOM_SENSITIVITY = 0.01;

export interface BoardCanvasProps {
  readonly viewport: Viewport;
  readonly onViewportChange: (viewport: Viewport) => void;
  readonly theme?: CanvasTheme;
}

interface Size {
  readonly width: number;
  readonly height: number;
}

export function BoardCanvas({
  viewport,
  onViewportChange,
  theme,
}: BoardCanvasProps) {
  // ref ではなく state で要素を保持する。要素が挿入された時点で再レンダリングが
  // 走るため、サイズ計測とイベント登録の副作用を素直に書ける。
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);

  // 要素のサイズに追従する。
  useEffect(() => {
    if (canvas === null) {
      return;
    }
    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvas]);

  // 状態が変わるたびに全体を描き直す。
  useEffect(() => {
    if (canvas === null) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (ctx === null) {
      return;
    }
    const dpr = window.devicePixelRatio;
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);

    renderBoard(ctx, {
      width: size.width,
      height: size.height,
      devicePixelRatio: dpr,
      viewport,
      ...(theme !== undefined ? { theme } : {}),
    });
  }, [canvas, size, viewport, theme]);

  // ホイールとドラッグの操作。preventDefault が必要なため React の合成イベント
  // ではなく passive: false のネイティブリスナを使う（macOS のページ全体の
  // ズームやラバーバンドを抑止するため）。
  useEffect(() => {
    if (canvas === null) {
      return;
    }

    /** ドラッグ中の直前のポインタ位置。null ならドラッグ中でない。 */
    let panOrigin: { x: number; y: number } | null = null;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = canvas.getBoundingClientRect();
        const anchor = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        const factor = Math.exp(-event.deltaY * ZOOM_SENSITIVITY);
        onViewportChange(zoomAt(viewport, anchor, factor));
        return;
      }
      // ホイール/二本指スクロールの向きと内容の動く向きを合わせる
      onViewportChange(panBy(viewport, -event.deltaX, -event.deltaY));
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      panOrigin = { x: event.clientX, y: event.clientY };
      setIsPanning(true);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (panOrigin === null) {
        return;
      }
      const dx = event.clientX - panOrigin.x;
      const dy = event.clientY - panOrigin.y;
      panOrigin = { x: event.clientX, y: event.clientY };
      onViewportChange(panBy(viewport, dx, dy));
    };

    const handlePointerUp = () => {
      if (panOrigin === null) {
        return;
      }
      panOrigin = null;
      setIsPanning(false);
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [canvas, viewport, onViewportChange]);

  return (
    <canvas
      ref={setCanvas}
      data-testid="board-canvas"
      className="board-canvas"
      style={{ cursor: isPanning ? "grabbing" : "grab" }}
    />
  );
}
