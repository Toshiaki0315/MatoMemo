import { useCallback, useEffect, useRef, useState } from "react";
import {
  createImage,
  createShape,
  createStickyNote,
  createText,
  type Item,
  type ConnectorKind,
  type ItemId,
  type ShapeKind,
  type StickyColor,
} from "../domain/board";
import { findItem } from "../domain/boardOps";
import { rectCenter, type Point } from "../domain/geometry";
import {
  clampScale,
  visibleWorldRect,
  zoomAt,
  createViewport,
} from "../domain/viewport";
import type { BoardFileStore } from "../platform/boardFileStore";
import { createTauriBoardFileStore } from "../platform/tauriBoardFileStore";
import { pickImage, type ImagePicker } from "../platform/imagePicker";
import {
  closeWindow as closeWindowDefault,
  guardWindowClose,
  type CloseRequestGuard,
} from "../platform/windowCloseGuard";
import { useBoardStore, type BoardStore } from "../store/boardStore";
import { BoardCanvas, type ContextMenuTarget } from "./BoardCanvas";
import { ConfirmDialog } from "./ConfirmDialog";
import { ContextMenu } from "./ContextMenu";
import { FileBar } from "./FileBar";
import { ItemTextEditor, type TextEditableItem } from "./ItemTextEditor";
import { TextPropertiesPanel } from "./TextPropertiesPanel";
import { Toolbar } from "./Toolbar";
import { useImageCache } from "./useImageCache";

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
  /** 画像を選ばせる手段。テストでは差し替える。 */
  readonly imagePicker?: ImagePicker;
  /** ボードの読み書きの手段。テストではインメモリ実装に差し替える。 */
  readonly fileStore?: BoardFileStore;
  /** ウィンドウを閉じる要求の購読。テストでは差し替える。 */
  readonly closeGuard?: CloseRequestGuard;
  /** ウィンドウを実際に閉じる手段。テストでは差し替える。 */
  readonly closeWindow?: () => void | Promise<void>;
}

/** 未保存の変更を捨てる確認が要る操作。 */
type PendingAction = "new" | "open" | "close";

/** テキストを内包できるアイテムか。 */
function isTextEditable(item: Item | undefined): item is TextEditableItem {
  return (
    item !== undefined &&
    (item.type === "sticky" || item.type === "shape" || item.type === "text")
  );
}

/** 既定のファイルストア。モジュール読み込み時ではなく初回利用時に作る。 */
let defaultFileStore: BoardFileStore | undefined;
function getDefaultFileStore(): BoardFileStore {
  defaultFileStore ??= createTauriBoardFileStore();
  return defaultFileStore;
}

export function App({
  store = useBoardStore,
  imagePicker = pickImage,
  fileStore = getDefaultFileStore(),
  closeGuard = guardWindowClose,
  closeWindow = closeWindowDefault,
}: AppProps = {}) {
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
  const selectMany = store((state) => state.selectMany);
  const connectItems = store((state) => state.connectItems);
  const removeConnector = store((state) => state.removeConnector);
  const toggleConnectorArrow = store((state) => state.toggleConnectorArrow);
  const filePath = store((state) => state.filePath);
  const savedBoard = store((state) => state.savedBoard);
  const renameBoard = store((state) => state.renameBoard);
  const openBoard = store((state) => state.openBoard);
  const markSaved = store((state) => state.markSaved);
  const newBoard = store((state) => state.newBoard);
  const past = store((state) => state.past);
  const future = store((state) => state.future);
  const undo = store((state) => state.undo);
  const redo = store((state) => state.redo);
  const beginHistoryGroup = store((state) => state.beginHistoryGroup);
  const endHistoryGroup = store((state) => state.endHistoryGroup);
  const bringSelectedToFront = store((state) => state.bringSelectedToFront);
  const sendSelectedToBack = store((state) => state.sendSelectedToBack);
  const bringSelectedForward = store((state) => state.bringSelectedForward);
  const sendSelectedBackward = store((state) => state.sendSelectedBackward);
  const replaceItem = store((state) => state.replaceItem);
  const resizeItem = store((state) => state.resizeItem);

  /** 編集中のアイテム。null なら編集していない。 */
  const [editingId, setEditingId] = useState<ItemId | null>(null);
  /** 画像の取り込みに失敗したときのメッセージ。 */
  const [error, setError] = useState<string | null>(null);
  /** 右クリックメニューの状態。null なら出していない。 */
  const [menu, setMenu] = useState<{
    readonly target: ContextMenuTarget;
    readonly position: { x: number; y: number };
  } | null>(null);
  /** コネクタを引くモードか。 */
  const [connectMode, setConnectMode] = useState(false);
  /** 接続の始点として選ばれたアイテム。 */
  const [connectingFrom, setConnectingFrom] = useState<ItemId | null>(null);
  /** これから引くコネクタの種類。 */
  const [connectorKind, setConnectorKind] = useState<ConnectorKind>("straight");
  /** これから引くコネクタに矢印を付けるか。 */
  const [connectorArrow, setConnectorArrow] = useState(false);
  /** ファイル操作の実行中か。 */
  const [busy, setBusy] = useState(false);
  /** 未保存の変更の確認待ちになっている操作。 */
  const [pending, setPending] = useState<PendingAction | null>(null);

  const dirty = board !== savedBoard;
  // 閉じる要求のハンドラは一度しか登録しないので、最新の値は ref から読む
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  const images = useImageCache(board.items);
  const editingItem = editingId === null ? undefined : findItem(board, editingId);

  /** テキストアイテムを 1 つだけ選んでいるときにフォント設定を出す。 */
  const soleSelected =
    selectedIds.size === 1
      ? findItem(board, [...selectedIds][0] as ItemId)
      : undefined;

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

  const handleActivateItem = useCallback(
    (id: ItemId) => {
      if (isTextEditable(findItem(board, id))) {
        setEditingId(id);
      }
    },
    [board],
  );

  const handleAddImage = useCallback(async () => {
    setError(null);
    try {
      const imported = await imagePicker();
      if (imported === null) {
        return;
      }
      const { x, y } = nextItemPosition();
      addItem((id) => createImage({ id, x, y, ...imported }));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "画像を取り込めませんでした。",
      );
    }
  }, [addItem, imagePicker, nextItemPosition]);

  /**
   * ファイル操作の失敗を利用者に伝える。
   * StorageError も BoardFileError も Error を継承しているので、
   * それぞれのメッセージがそのまま表示される。
   */
  const reportFailure = useCallback((cause: unknown) => {
    setError(cause instanceof Error ? cause.message : "操作に失敗しました。");
  }, []);

  /** 保存先が決まっていればそこへ、なければ保存先を尋ねて保存する。 */
  const saveTo = useCallback(
    async (path: string | null) => {
      setError(null);
      setBusy(true);
      try {
        if (path === null) {
          const chosen = await fileStore.saveAs(board);
          if (chosen !== null) {
            markSaved(chosen);
          }
          return;
        }
        await fileStore.save(path, board);
        markSaved(path);
      } catch (cause) {
        reportFailure(cause);
      } finally {
        setBusy(false);
      }
    },
    [board, fileStore, markSaved, reportFailure],
  );

  const handleSave = useCallback(() => {
    void saveTo(filePath);
  }, [filePath, saveTo]);

  const handleSaveAs = useCallback(() => {
    void saveTo(null);
  }, [saveTo]);

  /** 確認を経たうえで実際に行う破壊的な操作。 */
  const runPending = useCallback(
    async (action: PendingAction) => {
      if (action === "new") {
        newBoard();
        return;
      }
      if (action === "close") {
        await closeWindow();
        return;
      }
      setError(null);
      setBusy(true);
      try {
        const opened = await fileStore.open();
        if (opened !== null) {
          openBoard(opened.board, opened.path);
        }
      } catch (cause) {
        reportFailure(cause);
      } finally {
        setBusy(false);
      }
    },
    [closeWindow, fileStore, newBoard, openBoard, reportFailure],
  );

  /** 未保存なら確認してから、そうでなければそのまま実行する。 */
  const requestAction = useCallback(
    (action: PendingAction) => {
      setMenu(null);
      setEditingId(null);
      if (dirty) {
        setPending(action);
        return;
      }
      void runPending(action);
    },
    [dirty, runPending],
  );

  const handleContextMenu = useCallback(
    (target: ContextMenuTarget | null, position: { x: number; y: number }) => {
      if (target === null) {
        setMenu(null);
        return;
      }
      // 未選択のアイテムを右クリックしたら、そのアイテムを対象にする
      if (target.kind === "item" && !selectedIds.has(target.id)) {
        selectOnly(target.id);
      }
      setEditingId(null);
      setMenu({ target, position });
    },
    [selectOnly, selectedIds],
  );

  /** 接続モードでアイテムが選ばれたときの処理。 */
  const handlePickForConnection = useCallback(
    (id: ItemId) => {
      // 状態更新関数の中でストアを触らない。React は更新関数をレンダリング中に
      // 呼ぶことがあり、その中で別のコンポーネントを更新すると警告になるうえ、
      // 二重に呼ばれてコネクタが重複して作られる恐れがある。
      if (connectingFrom === null) {
        setConnectingFrom(id);
        return;
      }
      connectItems(connectingFrom, id, connectorKind, connectorArrow);
      // 続けて別の線を引けるよう、始点を空にしてモードは維持する
      setConnectingFrom(null);
    },
    [connectItems, connectingFrom, connectorArrow, connectorKind],
  );

  /** 接続モードの開始・終了。 */
  const toggleConnectMode = useCallback(() => {
    setConnectMode((current) => !current);
    setConnectingFrom(null);
    clearSelection();
  }, [clearSelection]);

  const handleSelect = useCallback(
    (id: ItemId | null, additive: boolean) => {
      // 別のアイテムを触ったら編集とメニューを終える
      setEditingId((current) => (current === id ? current : null));
      setMenu(null);
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

  // ウィンドウを閉じる要求を横取りし、未保存なら確認してから閉じる。
  useEffect(() => {
    let stop: (() => void) | undefined;
    let disposed = false;

    closeGuard(() => {
      // 未保存でなければそのまま閉じてよい
      if (!dirtyRef.current) {
        return true;
      }
      setPending("close");
      return false;
    })
      .then((unlisten) => {
        if (disposed) {
          unlisten();
          return;
        }
        stop = unlisten;
      })
      .catch(() => {
        // Tauri の外（ブラウザでの開発時など）では購読できない。
        // 閉じる前の確認が付かないだけなので、編集は続けられるようにする。
      });

    return () => {
      disposed = true;
      stop?.();
    };
  }, [closeGuard]);

  // Command + S / O / N のキーボード操作。
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey || event.altKey || event.ctrlKey) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        if (event.shiftKey) {
          handleSaveAs();
        } else {
          handleSave();
        }
        return;
      }
      if (key === "o") {
        event.preventDefault();
        requestAction("open");
        return;
      }
      if (key === "n") {
        event.preventDefault();
        requestAction("new");
        return;
      }
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, handleSaveAs, redo, requestAction, undo]);

  const zoomPercent = Math.round(clampScale(viewport.scale) * 100);

  return (
    <main className="app">
      <FileBar
        boardName={board.name}
        onRename={renameBoard}
        dirty={dirty}
        onNew={() => requestAction("new")}
        onOpen={() => requestAction("open")}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        busy={busy}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
      />

      <BoardCanvas
        board={board}
        viewport={viewport}
        selectedIds={selectedIds}
        onViewportChange={setViewport}
        onSelect={handleSelect}
        onSelectMany={selectMany}
        onMoveSelected={moveSelected}
        onResizeItem={resizeItem}
        onDeleteSelected={removeSelected}
        onBeginInteraction={beginHistoryGroup}
        onEndInteraction={endHistoryGroup}
        onContextMenu={handleContextMenu}
        onActivateItem={handleActivateItem}
        connectMode={connectMode}
        onPickForConnection={handlePickForConnection}
        {...(connectingFrom !== null ? { connectingFrom } : {})}
        images={images}
        {...(editingId !== null ? { editingItemId: editingId } : {})}
      />

      {isTextEditable(editingItem) ? (
        <ItemTextEditor
          item={editingItem}
          viewport={viewport}
          onChangeText={(text) => replaceItem({ ...editingItem, text })}
          onClose={() => setEditingId(null)}
        />
      ) : null}

      {soleSelected?.type === "text" ? (
        <TextPropertiesPanel
          item={soleSelected}
          onChangeFontFamily={(fontFamily) =>
            replaceItem({ ...soleSelected, fontFamily })
          }
          onChangeFontSize={(fontSize) =>
            replaceItem({ ...soleSelected, fontSize })
          }
        />
      ) : null}

      <Toolbar
        onAddSticky={handleAddSticky}
        onAddShape={handleAddShape}
        onAddText={handleAddText}
        onAddImage={handleAddImage}
        canDelete={selectedIds.size > 0}
        onDeleteSelected={removeSelected}
        connectMode={connectMode}
        onToggleConnectMode={toggleConnectMode}
        connectorKind={connectorKind}
        onChangeConnectorKind={setConnectorKind}
        connectorArrow={connectorArrow}
        onChangeConnectorArrow={setConnectorArrow}
      />

      {menu === null ? null : (
        <ContextMenu
          position={menu.position}
          onClose={() => setMenu(null)}
          actions={
            menu.target.kind === "connector"
              ? [
                  {
                    label: "矢印を切り替え",
                    onSelect: () => toggleConnectorArrow(menu.target.id),
                  },
                  {
                    label: "線を削除",
                    onSelect: () => removeConnector(menu.target.id),
                  },
                ]
              : [
                  { label: "最前面へ移動", onSelect: bringSelectedToFront },
                  { label: "一つ手前へ", onSelect: bringSelectedForward },
                  { label: "一つ奥へ", onSelect: sendSelectedBackward },
                  { label: "最背面へ移動", onSelect: sendSelectedToBack },
                  { label: "削除", onSelect: removeSelected },
                ]
          }
        />
      )}

      {pending === null ? null : (
        <ConfirmDialog
          message={
            pending === "close"
              ? "保存していない変更があります。保存せずに終了しますか？"
              : "保存していない変更があります。破棄して続けますか？"
          }
          confirmLabel={pending === "close" ? "保存せずに終了" : "破棄して続行"}
          onConfirm={() => {
            const action = pending;
            setPending(null);
            void runPending(action);
          }}
          onCancel={() => setPending(null)}
        />
      )}

      {error === null ? null : (
        <div className="error-banner" role="alert">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="閉じる">
            ×
          </button>
        </div>
      )}

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
