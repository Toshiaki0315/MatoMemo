/**
 * ホワイトボードのキャンバス。
 *
 * 状態は props で受け取る制御コンポーネントとし、内部に持たない。
 * ズーム倍率の表示やツールバーなど外側の UI と同じ状態を共有するため。
 */

import {
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Board, ConnectorId, Item, ItemId } from "../domain/board";
import type { Rect } from "../domain/geometry";
import {
  hitTestConnector,
  hitTestConnectorBend,
  hitTestConnectorEnd,
} from "../domain/connectorHitTest";
import { bendForPoint } from "../domain/connectorPath";
import { findItem } from "../domain/boardOps";
import { rectFromCorners, type Point } from "../domain/geometry";
import { hitTest, itemsWithinRect } from "../domain/hitTest";
import {
  cursorForHandle,
  hitTestHandle,
  type ResizeHandle,
} from "../domain/resize";
import {
  scrollbarModel,
  thumbLayout,
  type ScrollbarTrack,
} from "../domain/scrollbars";
import { panBy, toWorld, zoomAt, type Viewport } from "../domain/viewport";
import { renderBoard, type CanvasTheme } from "../render/boardRenderer";
import type { ImageCache } from "../render/itemRenderer";
import { isEditableTarget } from "./editableTarget";

/**
 * ホイールの移動量をズーム倍率に変換する係数。
 * macOS のトラックパッドのピンチ操作は ctrlKey 付きの wheel として届く。
 */
const ZOOM_SENSITIVITY = 0.01;

/** スクロールバーの帯の太さ (px)。もう一方のバーと重ならない余白も兼ねる。 */
const SCROLLBAR_GUTTER = 12;

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
  /** 折れ線の中間の線をドラッグしたとき。bend は始点側 0〜終点側 1。 */
  readonly onBendConnector?: (id: ConnectorId, bend: number) => void;
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
  /**
   * ファイルが落とされたとき。位置はワールド座標。
   * 取り込みそのものは呼び出し側に任せ、ここでは位置だけを解決する。
   */
  readonly onDropFiles?: (files: readonly File[], world: Point) => void;
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
    }
  | {
      /** 折れ線の中間の線を動かして折れる位置を変える。 */
      readonly kind: "bend";
      readonly id: ConnectorId;
    };

export function BoardCanvas({
  board,
  viewport,
  selectedIds,
  selectedConnectorId,
  onSelectConnector,
  onReconnect,
  onBendConnector,
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
  onDropFiles,
}: BoardCanvasProps) {
  // ref ではなく state で要素を保持する。要素が挿入された時点で再レンダリングが
  // 走るため、サイズ計測とイベント登録の副作用を素直に書ける。
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);
  /**
   * 何らかのドラッグ（移動・リサイズ・範囲選択など）の最中か。
   * 操作は掴んだ時点で確定しているので、途中で Space を押されても
   * カーソルを手のひらに変えないために使う。
   */
  const [dragActive, setDragActive] = useState(false);
  /** ポインタの下にあるハンドル。カーソルの見た目に使う。 */
  const [hoveredHandle, setHoveredHandle] = useState<ResizeHandle | null>(null);
  /** ポインタが線の端点の上にあるか。掴めることをカーソルで示す。 */
  const [hoveringConnectorEnd, setHoveringConnectorEnd] = useState(false);
  /** ポインタの下にある折れ線の中間の線の向き。カーソルの見た目に使う。 */
  const [hoveredBendSegment, setHoveredBendSegment] = useState<
    "vertical" | "horizontal" | null
  >(null);
  /** 範囲ドラッグ中の選択範囲（ワールド座標）。 */
  const [selectionRect, setSelectionRect] = useState<Rect | null>(null);
  /**
   * Space が押されているか。押している間はドラッグがパンになる。
   * イベントリスナは一度しか登録しないため ref で読み、カーソルの
   * 見た目（手のひら）にも反映するため state でも持つ。
   */
  const spacePressed = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);

  /**
   * 最新の props とドラッグ状態。
   *
   * 操作のイベントリスナは canvas の登場時に一度だけ登録し、以降は
   * 張り替えない。props を依存配列に入れると、ドラッグ中の状態更新の
   * たびにリスナが張り替えられ、進行中のドラッグが途切れてしまう。
   */
  // オブジェクトは一度だけ組み立てて初期値と更新で共用する。
  // 2 か所に同じ列挙を書くと、項目を増やしたときに片方だけ直して
  // 「初回の値のまま古くなる」バグを招くため。
  const latestProps = {
    board,
    viewport,
    selectedIds,
    selectedConnectorId,
    onSelectConnector,
    onReconnect,
    onBendConnector,
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
  const latest = useRef(latestProps);
  useEffect(() => {
    latest.current = latestProps;
  });

  /** ドラッグ中の状態。リスナの張り替えをまたいで保持する必要がある。 */
  const drag = useRef<{
    origin: { x: number; y: number };
    mode: DragMode;
  } | null>(null);

  /**
   * スクロールバーのつまみをドラッグ中の状態。
   *
   * 換算係数は開始時に固定する。ドラッグでビューポートが動くと
   * スクロール範囲も動いて再計算されるため、毎回計算し直すと
   * つまみが指を追い越したり遅れたりしてしまう。
   */
  const scrollDrag = useRef<{
    axis: "x" | "y";
    /** pointerdown 時の clientX / clientY。 */
    origin: number;
    /** 開始時のビューポート。 */
    viewport: Viewport;
    /** つまみを 1px 動かしたときのワールド座標の移動量。 */
    worldPerPixel: number;
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
        const target = hitTest(board.items, world, viewport.scale);
        if (target !== undefined) {
          onPickForConnection?.(target.id);
          return;
        }
        // 空白部分ではキャンバスを動かせるようにしておく
        drag.current = { origin, mode: { kind: "pan" } };
        setIsPanning(true);
        return;
      }

      // Space を押している間は、どこを掴んでもキャンバスを動かす。
      // カーソルも手のひらにしているので、掴む対象を選ばず一貫させる。
      if (spacePressed.current) {
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
      const grabbed = hitTestConnectorEnd(
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

      // 選択中の折れ線の中間の線。掴んで折れる位置を変えられる。
      const bendGrab = hitTestConnectorBend(
        board,
        latest.current.selectedConnectorId,
        world,
        viewport.scale,
      );
      if (bendGrab !== null) {
        drag.current = {
          origin,
          mode: { kind: "bend", id: bendGrab.id },
        };
        latest.current.onBeginInteraction?.();
        return;
      }

      const hit = hitTest(board.items, world, viewport.scale);
      const additive = event.shiftKey || event.metaKey;

      if (hit === undefined) {
        // アイテムに当たらなければ線を狙ったとみなす
        const connector = hitTestConnector(board, world, viewport.scale);
        if (connector !== undefined) {
          latest.current.onSelectConnector?.(connector.id);
          return;
        }
        latest.current.onSelectConnector?.(null);
        // 空白のドラッグは範囲選択にする（パンは Space + ドラッグ）
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
        const target = hitTest(latest.current.board.items, world, viewport.scale);
        if (target !== undefined) {
          latest.current.onReconnect?.(
            current.mode.id,
            current.mode.end,
            target.id,
          );
        }
        return;
      }
      if (current.mode.kind === "bend") {
        const { board } = latest.current;
        const bendId = current.mode.id;
        const connector = board.connectors.find(
          (candidate) => candidate.id === bendId,
        );
        if (connector === undefined) {
          return;
        }
        const fromItem = findItem(board, connector.fromItemId);
        const toItem = findItem(board, connector.toItemId);
        if (fromItem === undefined || toItem === undefined) {
          return;
        }
        const world = toWorld(viewport, toCanvasPoint(event));
        const bend = bendForPoint(fromItem, toItem, world);
        if (bend !== null) {
          latest.current.onBendConnector?.(current.mode.id, bend);
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
      const { board, viewport, selectedIds, selectedConnectorId } =
        latest.current;
      const world = toWorld(viewport, toCanvasPoint(event));

      setHoveringConnectorEnd(
        hitTestConnectorEnd(board, selectedConnectorId, world, viewport.scale) !==
          null,
      );

      const bend = hitTestConnectorBend(
        board,
        selectedConnectorId,
        world,
        viewport.scale,
      );
      setHoveredBendSegment(
        bend === null ? null : bend.verticalSegment ? "vertical" : "horizontal",
      );

      const target = findResizeTarget(board.items, selectedIds);
      setHoveredHandle(
        target === undefined
          ? null
          : (hitTestHandle(target, world, viewport.scale) ?? null),
      );
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
      const item = hitTest(board.items, world, viewport.scale);
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
      setDragActive(false);
      setSelectionRect(null);
      if (current.mode.kind !== "pan" && current.mode.kind !== "select") {
        latest.current.onEndInteraction?.();
      }
    };

    const handleDoubleClick = (event: MouseEvent) => {
      const { board, viewport, onActivateItem } = latest.current;
      const world = toWorld(viewport, toCanvasPoint(event));
      const hit = hitTest(board.items, world, viewport.scale);
      if (hit !== undefined) {
        onActivateItem?.(hit.id);
      }
    };

    /** ドラッグの開始判定を含むポインタ押下の処理。 */
    const handlePointerDownAndTrack = (event: PointerEvent) => {
      handlePointerDown(event);
      // どの種類のドラッグが始まったかによらず「ドラッグ中」を記録する
      setDragActive(drag.current !== null);
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("pointerdown", handlePointerDownAndTrack);
    canvas.addEventListener("dblclick", handleDoubleClick);
    canvas.addEventListener("contextmenu", handleContextMenu);
    canvas.addEventListener("pointermove", handleHover);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("pointerdown", handlePointerDownAndTrack);
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
      setSpaceHeld(pressed);
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

  // スクロールバー。内容が画面の外にあるときだけ現れる。
  const scrollbars = scrollbarModel(board.items, viewport, size);
  const trackLengths = {
    x: size.width - SCROLLBAR_GUTTER,
    y: size.height - SCROLLBAR_GUTTER,
  };
  const horizontalThumb =
    scrollbars.horizontal === null
      ? null
      : thumbLayout(scrollbars.horizontal, trackLengths.x);
  const verticalThumb =
    scrollbars.vertical === null
      ? null
      : thumbLayout(scrollbars.vertical, trackLengths.y);

  /**
   * ファイルのドラッグを受け入れる。
   *
   * 既定の動作を止めないと、ブラウザ（webview）が落とされた画像を
   * そのまま開いてしまい、drop が届かない。
   */
  const handleDragOver = (event: ReactDragEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  /** 落とされたファイルを、落とした位置のワールド座標とともに渡す。 */
  const handleDrop = (event: ReactDragEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const files = [...event.dataTransfer.files];
    if (files.length === 0) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const world = toWorld(viewport, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
    onDropFiles?.(files, world);
  };

  const beginScrollDrag =
    (axis: "x" | "y", track: ScrollbarTrack, movable: number) =>
    (event: ReactPointerEvent<HTMLDivElement>) => {
      // movable は thumbLayout が 0 より大きいことを保証している
      event.preventDefault();
      event.stopPropagation();
      // ポインタを捕まえ、つまみの外へ出てもドラッグが続くようにする
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // テスト環境 (jsdom) では使えない。つまみの上で動かす分には追従する
      }
      scrollDrag.current = {
        axis,
        origin: axis === "x" ? event.clientX : event.clientY,
        viewport,
        worldPerPixel: track.scrollableWorld / movable,
      };
    };

  const moveScrollDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = scrollDrag.current;
    if (current === null) {
      return;
    }
    const position = current.axis === "x" ? event.clientX : event.clientY;
    const deltaScreen =
      (position - current.origin) *
      current.worldPerPixel *
      current.viewport.scale;
    onViewportChange(
      current.axis === "x"
        ? { ...current.viewport, x: current.viewport.x - deltaScreen }
        : { ...current.viewport, y: current.viewport.y - deltaScreen },
    );
  };

  const endScrollDrag = () => {
    scrollDrag.current = null;
  };

  return (
    <>
      <canvas
        ref={setCanvas}
        data-testid="board-canvas"
        className="board-canvas"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          cursor: currentCursor(
            isPanning,
            spaceHeld && !dragActive,
            hoveredHandle,
            connectMode,
            hoveringConnectorEnd,
            hoveredBendSegment,
          ),
        }}
      />
      {scrollbars.horizontal !== null && horizontalThumb !== null ? (
        <div className="canvas-scrollbar canvas-scrollbar-horizontal">
          <div
            role="scrollbar"
            aria-label="横スクロール"
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(
              scrollbars.horizontal.thumbPosition * 100,
            )}
            className="canvas-scrollbar-thumb"
            style={{
              left: horizontalThumb.offset,
              width: horizontalThumb.length,
            }}
            onPointerDown={beginScrollDrag(
              "x",
              scrollbars.horizontal,
              horizontalThumb.movable,
            )}
            onPointerMove={moveScrollDrag}
            onPointerUp={endScrollDrag}
            onPointerCancel={endScrollDrag}
          />
        </div>
      ) : null}
      {scrollbars.vertical !== null && verticalThumb !== null ? (
        <div className="canvas-scrollbar canvas-scrollbar-vertical">
          <div
            role="scrollbar"
            aria-label="縦スクロール"
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(scrollbars.vertical.thumbPosition * 100)}
            className="canvas-scrollbar-thumb"
            style={{
              top: verticalThumb.offset,
              height: verticalThumb.length,
            }}
            onPointerDown={beginScrollDrag(
              "y",
              scrollbars.vertical,
              verticalThumb.movable,
            )}
            onPointerMove={moveScrollDrag}
            onPointerUp={endScrollDrag}
            onPointerCancel={endScrollDrag}
          />
        </div>
      ) : null}
    </>
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

/**
 * 状況に応じたカーソルの見た目。
 *
 * 既定は矢印で、クリックが「選択」を意味することを示す。手のひらは
 * 実際に掴める（パンできる）ときだけ出す。掴めないのに手のひらを
 * 出すと、空白のドラッグが範囲選択であることと食い違ってしまう。
 *
 * @param spaceHeld いま押せばパンになるか。ドラッグの最中は操作が
 *   確定済みなので、Space が押されていても呼び出し側で false にする
 */
function currentCursor(
  isPanning: boolean,
  spaceHeld: boolean,
  hoveredHandle: ResizeHandle | null,
  connectMode: boolean,
  hoveringConnectorEnd: boolean,
  hoveredBendSegment: "vertical" | "horizontal" | null,
): string {
  if (connectMode) {
    return "crosshair";
  }
  if (isPanning) {
    return "grabbing";
  }
  // Space を押している間はどこでも掴んでパンできる
  if (spaceHeld) {
    return "grab";
  }
  // 線の端点はアイテムの縁に重なるので、掴めることをカーソルで示す
  if (hoveringConnectorEnd) {
    return "move";
  }
  // 折れ線の中間の線は、縦向きなら左右、横向きなら上下に動かせる
  if (hoveredBendSegment !== null) {
    return hoveredBendSegment === "vertical" ? "ew-resize" : "ns-resize";
  }
  if (hoveredHandle !== null) {
    return cursorForHandle(hoveredHandle);
  }
  return "default";
}
