/**
 * ホワイトボードのキャンバス。
 *
 * 状態は props で受け取る制御コンポーネントとし、内部に持たない。
 * ズーム倍率の表示やツールバーなど外側の UI と同じ状態を共有するため。
 */

import { useEffect, useRef, useState } from "react";
import type { Board, ConnectorId, Item, ItemId } from "../domain/board";
import { hitTestConnector } from "../domain/connectorHitTest";
import { hitTest } from "../domain/hitTest";
import {
  cursorForHandle,
  hitTestHandle,
  type ResizeHandle,
} from "../domain/resize";
import { panBy, toWorld, zoomAt, type Viewport } from "../domain/viewport";
import { renderBoard, type CanvasTheme } from "../render/boardRenderer";
import type { ImageCache } from "../render/itemRenderer";

/**
 * ホイールの移動量をズーム倍率に変換する係数。
 * macOS のトラックパッドのピンチ操作は ctrlKey 付きの wheel として届く。
 */
const ZOOM_SENSITIVITY = 0.01;

export interface BoardCanvasProps {
  readonly board: Board;
  readonly viewport: Viewport;
  readonly selectedIds: ReadonlySet<ItemId>;
  readonly onViewportChange: (viewport: Viewport) => void;
  /**
   * アイテムが押されたときに呼ばれる。
   * @param id 押されたアイテム。空白部分なら null
   * @param additive Shift / Command を押しながらの操作か
   */
  readonly onSelect: (id: ItemId | null, additive: boolean) => void;
  /** 選択中のアイテムをワールド座標で移動する。 */
  readonly onMoveSelected: (dx: number, dy: number) => void;
  /** アイテムをリサイズする。移動量はワールド座標。 */
  readonly onResizeItem: (
    id: ItemId,
    handle: ResizeHandle,
    dx: number,
    dy: number,
  ) => void;
  readonly onDeleteSelected: () => void;
  /** 右クリックされたとき。空白部分なら target は null。 */
  readonly onContextMenu?: (
    target: ContextMenuTarget | null,
    position: { x: number; y: number },
  ) => void;
  /**
   * コネクタを引くモードか。
   * このモードではアイテムをクリックしても選択や移動をせず、接続先として拾う。
   */
  readonly connectMode?: boolean;
  /** 接続モードでアイテムが選ばれたとき。 */
  readonly onPickForConnection?: (id: ItemId) => void;
  /** 接続の始点として選ばれているアイテム。 */
  readonly connectingFrom?: ItemId;
  /** アイテムがダブルクリックされたとき。 */
  readonly onActivateItem?: (id: ItemId) => void;
  readonly theme?: CanvasTheme;
  readonly images?: ImageCache;
  /** 編集中のアイテム。Canvas 側ではそのテキストを描かない。 */
  readonly editingItemId?: ItemId;
}

/** 右クリックの対象。 */
export type ContextMenuTarget =
  | { readonly kind: "item"; readonly id: ItemId }
  | { readonly kind: "connector"; readonly id: ConnectorId };

interface Size {
  readonly width: number;
  readonly height: number;
}

/** ドラッグの種類。 */
type DragMode =
  | { readonly kind: "pan" }
  | { readonly kind: "item" }
  | { readonly kind: "resize"; readonly id: ItemId; readonly handle: ResizeHandle };

export function BoardCanvas({
  board,
  viewport,
  selectedIds,
  onViewportChange,
  onSelect,
  onMoveSelected,
  onResizeItem,
  onDeleteSelected,
  onContextMenu,
  connectMode = false,
  onPickForConnection,
  connectingFrom,
  onActivateItem,
  theme,
  images,
  editingItemId,
}: BoardCanvasProps) {
  // ref ではなく state で要素を保持する。要素が挿入された時点で再レンダリングが
  // 走るため、サイズ計測とイベント登録の副作用を素直に書ける。
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);
  /** ポインタの下にあるハンドル。カーソルの見た目に使う。 */
  const [hoveredHandle, setHoveredHandle] = useState<ResizeHandle | null>(null);

  /**
   * 最新の props とドラッグ状態。
   *
   * 操作のイベントリスナは canvas の登場時に一度だけ登録し、以降は
   * 張り替えない。props を依存配列に入れると、ドラッグ中の状態更新の
   * たびにリスナが張り替えられ、進行中のドラッグが途切れてしまう。
   */
  const latest = useRef({
    board,
    viewport,
    selectedIds,
    onViewportChange,
    onSelect,
    onMoveSelected,
    onResizeItem,
    onContextMenu,
    onActivateItem,
    connectMode,
    onPickForConnection,
  });
  useEffect(() => {
    latest.current = {
      board,
      viewport,
      selectedIds,
      onViewportChange,
      onSelect,
      onMoveSelected,
      onResizeItem,
      onContextMenu,
      onActivateItem,
      connectMode,
      onPickForConnection,
    };
  });

  /** ドラッグ中の状態。リスナの張り替えをまたいで保持する必要がある。 */
  const drag = useRef<{
    origin: { x: number; y: number };
    mode: DragMode;
  } | null>(null);

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
      items: board.items,
      connectors: board.connectors,
      selectedIds:
        connectingFrom === undefined
          ? selectedIds
          : new Set([...selectedIds, connectingFrom]),
      ...(theme !== undefined ? { theme } : {}),
      ...(images !== undefined ? { images } : {}),
      ...(editingItemId !== undefined ? { editingItemId } : {}),
    });
  }, [
    canvas,
    size,
    viewport,
    board.items,
    board.connectors,
    selectedIds,
    connectingFrom,
    theme,
    images,
    editingItemId,
  ]);

  // ホイールとドラッグの操作。preventDefault が必要なため React の合成イベント
  // ではなく passive: false のネイティブリスナを使う（macOS のページ全体の
  // ズームやラバーバンドを抑止するため）。
  useEffect(() => {
    if (canvas === null) {
      return;
    }

    /** 画面座標をキャンバス内の座標に直す。 */
    const toCanvasPoint = (event: { clientX: number; clientY: number }) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const { viewport, onViewportChange } = latest.current;
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY * ZOOM_SENSITIVITY);
        onViewportChange(zoomAt(viewport, toCanvasPoint(event), factor));
        return;
      }
      // ホイール/二本指スクロールの向きと内容の動く向きを合わせる
      onViewportChange(panBy(viewport, -event.deltaX, -event.deltaY));
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      const {
        board,
        viewport,
        selectedIds,
        onSelect,
        connectMode,
        onPickForConnection,
      } = latest.current;
      const world = toWorld(viewport, toCanvasPoint(event));
      const origin = { x: event.clientX, y: event.clientY };

      if (connectMode) {
        const target = hitTest(board.items, world);
        if (target !== undefined) {
          onPickForConnection?.(target.id);
          return;
        }
        // 空白部分ではキャンバスを動かせるようにしておく
        drag.current = { origin, mode: { kind: "pan" } };
        setIsPanning(true);
        return;
      }

      // リサイズハンドルはアイテム本体より優先して判定する。
      // 角のハンドルはアイテムの内側にも重なっているため。
      const target = findResizeTarget(board.items, selectedIds);
      if (target !== undefined) {
        const handle = hitTestHandle(target, world, viewport.scale);
        if (handle !== undefined) {
          drag.current = {
            origin,
            mode: { kind: "resize", id: target.id, handle },
          };
          return;
        }
      }

      const hit = hitTest(board.items, world);
      const additive = event.shiftKey || event.metaKey;

      if (hit === undefined) {
        drag.current = { origin, mode: { kind: "pan" } };
        setIsPanning(true);
        if (!additive) {
          onSelect(null, false);
        }
        return;
      }

      drag.current = { origin, mode: { kind: "item" } };
      // 選択済みのアイテムを掴んだ場合は選択を変えない。変えてしまうと
      // 複数選択したままの移動ができなくなる。
      if (additive || !selectedIds.has(hit.id)) {
        onSelect(hit.id, additive);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const current = drag.current;
      if (current === null) {
        return;
      }
      const { viewport, onViewportChange, onMoveSelected, onResizeItem } =
        latest.current;
      const dx = event.clientX - current.origin.x;
      const dy = event.clientY - current.origin.y;
      drag.current = {
        origin: { x: event.clientX, y: event.clientY },
        mode: current.mode,
      };

      if (current.mode.kind === "pan") {
        onViewportChange(panBy(viewport, dx, dy));
        return;
      }
      if (current.mode.kind === "resize") {
        onResizeItem(
          current.mode.id,
          current.mode.handle,
          dx / viewport.scale,
          dy / viewport.scale,
        );
        return;
      }
      // アイテムの移動量はワールド座標に直す
      onMoveSelected(dx / viewport.scale, dy / viewport.scale);
    };

    /** ドラッグしていないときは、ハンドルの上でカーソルを変える。 */
    const handleHover = (event: PointerEvent) => {
      if (drag.current !== null) {
        return;
      }
      const { board, viewport, selectedIds } = latest.current;
      const target = findResizeTarget(board.items, selectedIds);
      if (target === undefined) {
        setHoveredHandle(null);
        return;
      }
      const world = toWorld(viewport, toCanvasPoint(event));
      setHoveredHandle(hitTestHandle(target, world, viewport.scale) ?? null);
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      const { board, viewport, onContextMenu } = latest.current;
      if (onContextMenu === undefined) {
        return;
      }
      const world = toWorld(viewport, toCanvasPoint(event));
      const position = { x: event.clientX, y: event.clientY };

      // アイテムを先に見る。線がアイテムに重なっている場合、
      // 見た目の前面にあるアイテムを狙ったと解釈するのが自然なため。
      const item = hitTest(board.items, world);
      if (item !== undefined) {
        onContextMenu({ kind: "item", id: item.id }, position);
        return;
      }
      const connector = hitTestConnector(board, world, viewport.scale);
      onContextMenu(
        connector === undefined ? null : { kind: "connector", id: connector.id },
        position,
      );
    };

    const handlePointerUp = () => {
      if (drag.current === null) {
        return;
      }
      drag.current = null;
      setIsPanning(false);
    };

    const handleDoubleClick = (event: MouseEvent) => {
      const { board, viewport, onActivateItem } = latest.current;
      const world = toWorld(viewport, toCanvasPoint(event));
      const hit = hitTest(board.items, world);
      if (hit !== undefined) {
        onActivateItem?.(hit.id);
      }
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("dblclick", handleDoubleClick);
    canvas.addEventListener("contextmenu", handleContextMenu);
    canvas.addEventListener("pointermove", handleHover);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("dblclick", handleDoubleClick);
      canvas.removeEventListener("contextmenu", handleContextMenu);
      canvas.removeEventListener("pointermove", handleHover);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
    // 依存は canvas のみ。props は latest ref 経由で常に最新を読むため、
    // リスナを張り替える必要がない。
  }, [canvas]);

  // Delete / Backspace で選択中のアイテムを削除する。
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }
      // テキスト入力中は文字の削除が優先される
      if (isEditableTarget(event.target)) {
        return;
      }
      event.preventDefault();
      onDeleteSelected();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDeleteSelected]);

  return (
    <canvas
      ref={setCanvas}
      data-testid="board-canvas"
      className="board-canvas"
      style={{ cursor: currentCursor(isPanning, hoveredHandle, connectMode) }}
    />
  );
}

/** 1 件だけ選択しているアイテムを返す。リサイズの対象。 */
function findResizeTarget(
  items: readonly Item[],
  selectedIds: ReadonlySet<ItemId>,
): Item | undefined {
  if (selectedIds.size !== 1) {
    return undefined;
  }
  return items.find((item) => selectedIds.has(item.id));
}

/** 状況に応じたカーソルの見た目。 */
function currentCursor(
  isPanning: boolean,
  hoveredHandle: ResizeHandle | null,
  connectMode: boolean,
): string {
  if (connectMode) {
    return "crosshair";
  }
  if (hoveredHandle !== null) {
    return cursorForHandle(hoveredHandle);
  }
  return isPanning ? "grabbing" : "grab";
}

/** テキスト入力欄にフォーカスがあるかを判定する。 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}
