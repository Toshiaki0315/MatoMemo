import { useCallback } from "react";
import {
  createShape,
  createStickyNote,
  createText,
  type ItemId,
  type ShapeKind,
  type StickyColor,
} from "../domain/board";
import { rectCenter, type Point } from "../domain/geometry";
import {
  clampScale,
  visibleWorldRect,
  zoomAt,
  createViewport,
} from "../domain/viewport";
import { useBoardStore, type BoardStore } from "../store/boardStore";
import { BoardCanvas } from "./BoardCanvas";
import { Toolbar } from "./Toolbar";

/** ズームボタン 1 回あたりの倍率。 */
const ZOOM_STEP = 1.25;

/** 同じ場所に重ねて追加しないための階段状のずらし幅。 */
const CASCADE_OFFSET = 24;
const CASCADE_LENGTH = 8;

export interface AppProps {
  /**
   * 使用するストア。既定はアプリ全体で共有するストア。
   * テストでは独立したインスタンスを渡す。
   */
  readonly store?: BoardStore;
}

export function App({ store = useBoardStore }: AppProps = {}) {
  const board = store((state) => state.board);
  const viewport = store((state) => state.viewport);
  const selectedIds = store((state) => state.selectedIds);
  const setViewport = store((state) => state.setViewport);
  const addItem = store((state) => state.addItem);
  const moveSelected = store((state) => state.moveSelected);
  const removeSelected = store((state) => state.removeSelected);
  const selectOnly = store((state) => state.selectOnly);
  const toggleSelection = store((state) => state.toggleSelection);
  const clearSelection = store((state) => state.clearSelection);

  /**
   * 新しいアイテムを置く位置。
   * 見えている範囲の中央に置き、追加のたびに少しずつずらして
   * 完全に重ならないようにする。
   */
  const nextItemPosition = useCallback((): Point => {
    const visible = visibleWorldRect(
      viewport,
      window.innerWidth,
      window.innerHeight,
    );
    const center = rectCenter(visible);
    const step = (board.items.length % CASCADE_LENGTH) * CASCADE_OFFSET;
    return { x: center.x + step, y: center.y + step };
  }, [viewport, board.items.length]);

  const handleAddSticky = useCallback(
    (color: StickyColor) => {
      const { x, y } = nextItemPosition();
      addItem((id) => createStickyNote({ id, x, y, color }));
    },
    [addItem, nextItemPosition],
  );

  const handleAddShape = useCallback(
    (shape: ShapeKind) => {
      const { x, y } = nextItemPosition();
      addItem((id) => createShape({ id, shape, x, y }));
    },
    [addItem, nextItemPosition],
  );

  const handleAddText = useCallback(() => {
    const { x, y } = nextItemPosition();
    addItem((id) => createText({ id, x, y, text: "テキスト" }));
  }, [addItem, nextItemPosition]);

  const handleSelect = useCallback(
    (id: ItemId | null, additive: boolean) => {
      if (id === null) {
        clearSelection();
        return;
      }
      if (additive) {
        toggleSelection(id);
        return;
      }
      selectOnly(id);
    },
    [clearSelection, selectOnly, toggleSelection],
  );

  /** 画面中央を基準にズームする（ボタン操作用）。 */
  const zoomFromCenter = useCallback(
    (factor: number) => {
      setViewport(
        zoomAt(
          viewport,
          { x: window.innerWidth / 2, y: window.innerHeight / 2 },
          factor,
        ),
      );
    },
    [setViewport, viewport],
  );

  const zoomPercent = Math.round(clampScale(viewport.scale) * 100);

  return (
    <main className="app">
      <BoardCanvas
        board={board}
        viewport={viewport}
        selectedIds={selectedIds}
        onViewportChange={setViewport}
        onSelect={handleSelect}
        onMoveSelected={moveSelected}
        onDeleteSelected={removeSelected}
      />

      <Toolbar
        onAddSticky={handleAddSticky}
        onAddShape={handleAddShape}
        onAddText={handleAddText}
        canDelete={selectedIds.size > 0}
        onDeleteSelected={removeSelected}
      />

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
