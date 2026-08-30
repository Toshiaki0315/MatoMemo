/**
 * ホワイトボードのキャンバス。
 *
 * 状態は props で受け取る制御コンポーネントとし、内部に持たない。
 * ズーム倍率の表示やツールバーなど外側の UI と同じ状態を共有するため。
 */

import { useEffect, useRef, useState } from "react";
import type { Board, ConnectorId, Item, ItemId } from "../domain/board";
import type { Rect } from "../domain/geometry";
import { hitTestConnector } from "../domain/connectorHitTest";
import { connectorPath } from "../domain/connectorPath";
import { rectFromCorners, type Point } from "../domain/geometry";
import { hitTest, itemsWithinRect } from "../domain/hitTest";
import {
  cursorForHandle,
  HANDLE_HIT_SIZE,
  hitTestHandle,
  type ResizeHandle,
} from "../domain/resize";
import { connectorEnds } from "../render/connectorRenderer";
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
  /** 選択中のコネクタ。 */
  readonly selectedConnectorId?: ConnectorId;
  /** 線がクリックされたとき。空白なら null。 */
  readonly onSelectConnector?: (id: ConnectorId | null) => void;
  /** 線の端点を別のアイテムへ運んだとき。 */
  readonly onReconnect?: (
    id: ConnectorId,
    end: "from" | "to",
    itemId: ItemId,
  ) => void;
  readonly onViewportChange: (viewport: Viewport) => void;
  /**
   * アイテムが押されたときに呼ばれる。
   * @param id 押されたアイテム。空白部分なら null
   * @param additive Shift / Command を押しながらの操作か
   */
  readonly onSelect: (id: ItemId | null, additive: boolean) => void;
  /** 範囲ドラッグで囲まれたアイテムをまとめて選択する。 */
  readonly onSelectMany: (ids: readonly ItemId[], additive: boolean) => void;
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
  /**
   * ドラッグやリサイズの開始・終了。
   * 1 回の操作で起きる多数の更新を、1 回の取り消し単位にまとめるために使う。
   */
  readonly onBeginInteraction?: () => void;
  readonly onEndInteraction?: () => void;
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
  | {
      readonly kind: "select";
      /** 範囲選択を始めたワールド座標。 */
      readonly anchor: Point;
      /** 開始時点の選択（Shift 併用のときに引き継ぐ）。 */
      readonly base: readonly ItemId[];
    }
  | { readonly kind: "item" }
  | { readonly kind: "resize"; readonly id: ItemId; readonly handle: ResizeHandle }
  | {
      readonly kind: "reconnect";
      readonly id: ConnectorId;
      /** 掴んでいるのがどちらの端か。 */
      readonly end: "from" | "to";
    };

export function BoardCanvas({
  board,
  viewport,
  selectedIds,
  selectedConnectorId,
  onSelectConnector,
  onReconnect,
  onViewportChange,
  onSelect,
  onSelectMany,
  onMoveSelected,
  onResizeItem,
  onDeleteSelected,
  onBeginInteraction,
  onEndInteraction,
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
  /** 範囲ドラッグ中の選択範囲（ワールド座標）。 */
  const [selectionRect, setSelectionRect] = useState<Rect | null>(null);
  /** Space が押されているか。押している間はドラッグがパンになる。 */
  const spacePressed = useRef(false);

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
    selectedConnectorId,
    onSelectConnector,
    onReconnect,
    onViewportChange,
    onSelect,
    onSelectMany,
    onMoveSelected,
    onResizeItem,
    onContextMenu,
    onActivateItem,
    connectMode,
    onPickForConnection,
    onBeginInteraction,
    onEndInteraction,
  });
  useEffect(() => {
    latest.current = {
      board,
      viewport,
      selectedIds,
      selectedConnectorId,
      onSelectConnector,
      onReconnect,
      onViewportChange,
      onSelect,
      onSelectMany,
      onMoveSelected,
      onResizeItem,
      onContextMenu,
      onActivateItem,
      connectMode,
      onPickForConnection,
      onBeginInteraction,
      onEndInteraction,
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
      ...(selectedConnectorId !== undefined ? { selectedConnectorId } : {}),
      selectedIds:
        connectingFrom === undefined
          ? selectedIds
          : new Set([...selectedIds, connectingFrom]),
      ...(theme !== undefined ? { theme } : {}),
      ...(images !== undefined ? { images } : {}),
      ...(editingItemId !== undefined ? { editingItemId } : {}),
      ...(selectionRect !== null ? { selectionRect } : {}),
    });
  }, [
    canvas,
    size,
    viewport,
    board.items,
    board.connectors,
    selectedIds,
    selectedConnectorId,
    connectingFrom,
    theme,
    images,
    editingItemId,
    selectionRect,
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
          latest.current.onBeginInteraction?.();
          return;
        }
      }

      // 選択中の線の端点は、アイテムより先に判定する。
      // 端点はアイテムの縁に重なっているため。
      const grabbed = grabConnectorEnd(
        board,
        // props は latest ref から読む。effect は canvas の登場時に一度だけ
        // 実行されるので、クロージャの値は初回のまま古くなる。
        latest.current.selectedConnectorId,
        world,
        viewport.scale,
      );
      if (grabbed !== null) {
        drag.current = {
          origin,
          mode: { kind: "reconnect", ...grabbed },
        };
        latest.current.onBeginInteraction?.();
        return;
      }

      const hit = hitTest(board.items, world);
      const additive = event.shiftKey || event.metaKey;

      if (hit === undefined) {
        // アイテムに当たらなければ線を狙ったとみなす
        const connector = hitTestConnector(board, world, viewport.scale);
        if (connector !== undefined) {
          latest.current.onSelectConnector?.(connector.id);
          return;
        }
        latest.current.onSelectConnector?.(null);
        // Space を押しながらならキャンバスを動かす（デザインツールの慣例）。
        // それ以外の空白ドラッグは範囲選択にする。
        if (spacePressed.current) {
          drag.current = { origin, mode: { kind: "pan" } };
          setIsPanning(true);
          return;
        }
        drag.current = {
          origin,
          mode: {
            kind: "select",
            anchor: world,
            base: additive ? [...selectedIds] : [],
          },
        };
        setSelectionRect({ x: world.x, y: world.y, width: 0, height: 0 });
        if (!additive) {
          onSelect(null, false);
        }
        return;
      }

      latest.current.onSelectConnector?.(null);
      drag.current = { origin, mode: { kind: "item" } };
      latest.current.onBeginInteraction?.();
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
      if (current.mode.kind === "select") {
        const world = toWorld(viewport, toCanvasPoint(event));
        const rect = rectFromCorners(current.mode.anchor, world);
        setSelectionRect(rect);
        const inside = itemsWithinRect(latest.current.board.items, rect).map(
          (item) => item.id,
        );
        latest.current.onSelectMany([...current.mode.base, ...inside], false);
        return;
      }
      if (current.mode.kind === "reconnect") {
        // 運んだ先のアイテムに繋ぎ替える。アイテムの外では何もしない。
        const world = toWorld(viewport, toCanvasPoint(event));
        const target = hitTest(latest.current.board.items, world);
        if (target !== undefined) {
          latest.current.onReconnect?.(
            current.mode.id,
            current.mode.end,
            target.id,
          );
        }
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
      const current = drag.current;
      if (current === null) {
        return;
      }
      drag.current = null;
      setIsPanning(false);
      setSelectionRect(null);
      if (current.mode.kind !== "pan" && current.mode.kind !== "select") {
        latest.current.onEndInteraction?.();
      }
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

  // Space を押している間はキャンバスを動かせるようにする。
  useEffect(() => {
    const setPressed = (pressed: boolean) => {
      spacePressed.current = pressed;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isEditableTarget(event.target)) {
        return;
      }
      // Space でのスクロールを止める
      event.preventDefault();
      setPressed(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        setPressed(false);
      }
    };
    // ウィンドウから離れた隙に離された場合に備える
    const handleBlur = () => setPressed(false);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

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

/**
 * 選択中のコネクタの端点を掴んだかを判定する。
 * 掴んでいればどちらの端かを返す。
 */
function grabConnectorEnd(
  board: Board,
  selectedConnectorId: ConnectorId | undefined,
  world: Point,
  scale: number,
): { id: ConnectorId; end: "from" | "to" } | null {
  if (selectedConnectorId === undefined) {
    return null;
  }
  const connector = board.connectors.find(
    (candidate) => candidate.id === selectedConnectorId,
  );
  if (connector === undefined) {
    return null;
  }
  const byId = new Map(board.items.map((item) => [item.id, item]));
  const fromItem = byId.get(connector.fromItemId);
  const toItem = byId.get(connector.toItemId);
  if (fromItem === undefined || toItem === undefined) {
    return null;
  }
  const reach = HANDLE_HIT_SIZE / scale / 2;
  const path = connectorPath(connector.kind, fromItem, toItem);
  for (const { end, point } of connectorEnds(path)) {
    if (Math.hypot(world.x - point.x, world.y - point.y) <= reach) {
      return { id: connector.id, end };
    }
  }
  return null;
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
