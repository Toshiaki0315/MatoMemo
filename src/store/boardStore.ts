/**
 * アプリケーションの状態を保持するストア。
 *
 * ドメインロジックそのものは `domain/` の純関数に置き、ここでは
 * 「どの純関数をどの順で呼ぶか」だけを担う薄い層に留める。
 * これによりロジックのテストはストアを介さずに書ける。
 *
 * ストアは生成関数として公開する。テストごとに独立したインスタンスを
 * 作れるようにし、id 生成器も差し替えられるようにするため。
 */

import { create, type StoreApi, type UseBoundStore } from "zustand";
import {
  createBoard,
  createConnector,
  type Board,
  type Connector,
  type ConnectorId,
  type ConnectorKind,
  type Item,
  type ItemId,
} from "../domain/board";
import {
  addConnector as addConnectorToBoard,
  addItem as addItemToBoard,
  moveItems,
  removeConnectors,
  removeItems,
  replaceItem as replaceItemInBoard,
} from "../domain/boardOps";
import { createId as defaultCreateId } from "../domain/ids";
import { resizeRect, type ResizeHandle } from "../domain/resize";
import { createViewport, type Viewport } from "../domain/viewport";
import {
  bringForward,
  bringToFront,
  sendBackward,
  sendToBack,
} from "../domain/zorder";

/** 保持する取り消し履歴の上限。 */
export const HISTORY_LIMIT = 100;

export interface BoardState {
  readonly board: Board;
  readonly viewport: Viewport;
  /** 選択中のアイテム id。 */
  readonly selectedIds: ReadonlySet<ItemId>;
  /** 選択中のコネクタ。アイテムとは同時に選択しない。 */
  readonly selectedConnectorId: ConnectorId | null;

  /** 保存先のパス。まだ保存していなければ null。 */
  readonly filePath: string | null;
  /**
   * 最後に保存・読み込みした時点のボード。
   *
   * 未保存かどうかは「今のボードとこれが同じ参照か」で判定する。
   * 更新はすべて不変で行い、内容が変わらない操作は同じ参照を返すため、
   * 参照比較だけで変更の有無が分かり、フラグの立て忘れが起きない。
   */
  readonly savedBoard: Board;

  /** 取り消せる過去のボード（古い順）。 */
  readonly past: readonly Board[];
  /** やり直せる未来のボード（近い順）。 */
  readonly future: readonly Board[];
  /** 連続した変更を 1 回の取り消し単位にまとめている最中か。 */
  readonly grouping: boolean;

  /** 未保存の変更があるか。 */
  isDirty(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): void;
  redo(): void;
  /**
   * ここから `endHistoryGroup` までの変更を 1 回の取り消しでまとめて戻す。
   * ドラッグのように 1 回の操作が多数の更新を生む場面で使う。
   */
  beginHistoryGroup(): void;
  endHistoryGroup(): void;

  /** ボードの名前を変える。 */
  renameBoard(name: string): void;
  /** 読み込んだボードで置き換える。 */
  openBoard(board: Board, filePath: string): void;
  /** 保存が完了したことを記録する。 */
  markSaved(filePath: string): void;
  /** 新しい空のボードにする。 */
  newBoard(): void;

  setViewport(viewport: Viewport): void;

  /**
   * id を採番してアイテムを追加し、そのアイテムを選択状態にする。
   * @param create 採番された id を受け取ってアイテムを組み立てる関数
   * @returns 追加したアイテムの id
   */
  addItem(create: (id: ItemId) => Item): ItemId;
  replaceItem(item: Item): void;
  moveSelected(dx: number, dy: number): void;
  /**
   * アイテムをリサイズする。画像は原寸の縦横比を必ず保つ。
   * @param dx ハンドルの移動量（ワールド座標）
   */
  resizeItem(id: ItemId, handle: ResizeHandle, dx: number, dy: number): void;
  removeSelected(): void;

  /**
   * アイテム同士を結ぶコネクタを追加する。
   * 同じ組み合わせが既にある場合や自分自身への接続は追加しない。
   * @returns 追加した場合は id、追加しなかった場合は null
   */
  connectItems(
    fromItemId: ItemId,
    toItemId: ItemId,
    kind: ConnectorKind,
    arrow?: boolean,
  ): ConnectorId | null;
  /** 既存のコネクタの矢印の有無を切り替える。 */
  toggleConnectorArrow(id: ConnectorId): void;
  /** コネクタの設定を差し替える。 */
  replaceConnector(connector: Connector): void;
  /** コネクタの接続先を付け替える。 */
  reconnect(id: ConnectorId, end: "from" | "to", itemId: ItemId): void;
  removeConnector(id: ConnectorId): void;
  /** コネクタを選択する。null なら選択解除。 */
  selectConnector(id: ConnectorId | null): void;
  /** 選択中のコネクタを削除する。 */
  removeSelectedConnector(): void;

  /** 選択中のアイテムの重なり順を変える。 */
  bringSelectedToFront(): void;
  sendSelectedToBack(): void;
  bringSelectedForward(): void;
  sendSelectedBackward(): void;

  selectOnly(id: ItemId): void;
  toggleSelection(id: ItemId): void;
  selectMany(ids: readonly ItemId[]): void;
  clearSelection(): void;
  /** 選択中のアイテムを重なり順（背面→前面）で返す。 */
  selectedItems(): readonly Item[];
}

export interface BoardStoreOptions {
  /** id の採番方法。テストでは決定的な実装を渡す。 */
  readonly createId?: () => string;
}

export type BoardStore = UseBoundStore<StoreApi<BoardState>>;

/**
 * ボードを差し替えた状態の断片を組み立て、同時に履歴を積む。
 *
 * 内容が変わらない場合は何も返さない。ボードの更新はすべて不変で行い、
 * 変化のない操作は同じ参照を返すため、参照比較だけで判定できる。
 */
function withBoard(state: BoardState, next: Board): Partial<BoardState> {
  if (next === state.board) {
    return {};
  }
  return {
    board: next,
    // まとめている最中は、開始時に積んだ 1 件だけを取り消し単位とする
    past: state.grouping
      ? state.past
      : [...state.past, state.board].slice(-HISTORY_LIMIT),
    future: [],
  };
}

/** 今のボードに存在しないアイテムを選択から外す。 */
function pruneSelection(
  selectedIds: ReadonlySet<ItemId>,
  board: Board,
): ReadonlySet<ItemId> {
  const alive = new Set(board.items.map((item) => item.id));
  const next = new Set([...selectedIds].filter((id) => alive.has(id)));
  return next.size === selectedIds.size ? selectedIds : next;
}

export function createBoardStore(options: BoardStoreOptions = {}): BoardStore {
  const createId = options.createId ?? defaultCreateId;
  const initialBoard = createBoard({ id: createId() });

  return create<BoardState>()((set, get) => {
    /** 重なり順の操作を適用する。 */
    const reorder = (
      operation: (
        items: readonly Item[],
        ids: readonly ItemId[],
      ) => readonly Item[],
    ): void => {
      set((state) => {
        const items = operation(state.board.items, [...state.selectedIds]);
        // 並びが変わらなければボードの参照も変えない。
        // 変えてしまうと未保存扱いになり、履歴にも無駄が積まれる。
        if (items === state.board.items) {
          return state;
        }
        return withBoard(state, { ...state.board, items });
      });
    };

    /** 履歴を空にしてボードを差し替える（読み込み・新規作成）。 */
    const replaceBoard = (board: Board, filePath: string | null): void => {
      set({
        board,
        savedBoard: board,
        filePath,
        selectedIds: new Set<ItemId>(),
        selectedConnectorId: null,
        viewport: createViewport(),
        past: [],
        future: [],
        grouping: false,
      });
    };

    return {
      board: initialBoard,
      viewport: createViewport(),
      selectedIds: new Set<ItemId>(),
      selectedConnectorId: null,
      filePath: null,
      savedBoard: initialBoard,
      past: [],
      future: [],
      grouping: false,

      isDirty() {
        const { board, savedBoard } = get();
        return board !== savedBoard;
      },

      canUndo() {
        return get().past.length > 0;
      },

      canRedo() {
        return get().future.length > 0;
      },

      undo() {
        set((state) => {
          const previous = state.past.at(-1);
          if (previous === undefined) {
            return state;
          }
          return {
            board: previous,
            past: state.past.slice(0, -1),
            future: [state.board, ...state.future],
            selectedIds: pruneSelection(state.selectedIds, previous),
          };
        });
      },

      redo() {
        set((state) => {
          const next = state.future[0];
          if (next === undefined) {
            return state;
          }
          return {
            board: next,
            past: [...state.past, state.board].slice(-HISTORY_LIMIT),
            future: state.future.slice(1),
            selectedIds: pruneSelection(state.selectedIds, next),
          };
        });
      },

      beginHistoryGroup() {
        set((state) => {
          if (state.grouping) {
            return state;
          }
          return {
            grouping: true,
            past: [...state.past, state.board].slice(-HISTORY_LIMIT),
            future: [],
          };
        });
      },

      endHistoryGroup() {
        set((state) => {
          if (!state.grouping) {
            return state;
          }
          // 結局何も変わらなかった場合は、積んだ履歴を取り消す
          const unchanged = state.past.at(-1) === state.board;
          return {
            grouping: false,
            past: unchanged ? state.past.slice(0, -1) : state.past,
          };
        });
      },

      renameBoard(name) {
        set((state) => withBoard(state, { ...state.board, name }));
      },

      openBoard(board, filePath) {
        replaceBoard(board, filePath);
      },

      markSaved(filePath) {
        set((state) => ({ savedBoard: state.board, filePath }));
      },

      newBoard() {
        replaceBoard(createBoard({ id: createId() }), null);
      },

      setViewport(viewport) {
        set({ viewport });
      },

      addItem(create) {
        const id = createId();
        set((state) => ({
          ...withBoard(state, addItemToBoard(state.board, create(id))),
          // 追加直後は続けて編集・移動することが多いため選択状態にする
          selectedIds: new Set([id]),
        }));
        return id;
      },

      replaceItem(item) {
        set((state) => withBoard(state, replaceItemInBoard(state.board, item)));
      },

      moveSelected(dx, dy) {
        set((state) =>
          withBoard(
            state,
            moveItems(state.board, [...state.selectedIds], dx, dy),
          ),
        );
      },

      resizeItem(id, handle, dx, dy) {
        set((state) => {
          const item = state.board.items.find(
            (candidate) => candidate.id === id,
          );
          if (item === undefined) {
            return state;
          }
          // 画像は縦横比を維持する。原寸の比を基準にすることで、
          // 何度リサイズしても元の比から少しずつずれていくことがない。
          const resizeOptions =
            item.type === "image"
              ? { aspectRatio: item.naturalWidth / item.naturalHeight }
              : {};
          const bounds = resizeRect(
            { x: item.x, y: item.y, width: item.width, height: item.height },
            handle,
            dx,
            dy,
            resizeOptions,
          );
          return withBoard(
            state,
            replaceItemInBoard(state.board, { ...item, ...bounds }),
          );
        });
      },

      removeSelected() {
        set((state) => {
          if (state.selectedIds.size === 0) {
            return state;
          }
          return {
            ...withBoard(
              state,
              removeItems(state.board, [...state.selectedIds]),
            ),
            selectedIds: new Set<ItemId>(),
          };
        });
      },

      connectItems(fromItemId, toItemId, kind, arrow = false) {
        // 自分自身への接続は線として描けないため作らない
        if (fromItemId === toItemId) {
          return null;
        }
        const { board } = get();
        const duplicated = board.connectors.some(
          (connector) =>
            (connector.fromItemId === fromItemId &&
              connector.toItemId === toItemId) ||
            (connector.fromItemId === toItemId &&
              connector.toItemId === fromItemId),
        );
        if (duplicated) {
          return null;
        }
        const id = createId();
        set((state) =>
          withBoard(
            state,
            addConnectorToBoard(
              state.board,
              createConnector({ id, fromItemId, toItemId, kind, arrow }),
            ),
          ),
        );
        return id;
      },

      replaceConnector(connector) {
        set((state) =>
          withBoard(state, {
            ...state.board,
            connectors: state.board.connectors.map((existing) =>
              existing.id === connector.id ? connector : existing,
            ),
          }),
        );
      },

      reconnect(id, end, itemId) {
        set((state) => {
          const target = state.board.connectors.find(
            (connector) => connector.id === id,
          );
          if (target === undefined) {
            return state;
          }
          const next =
            end === "from"
              ? { ...target, fromItemId: itemId }
              : { ...target, toItemId: itemId };
          // 同じアイテム同士は線として描けないので付け替えない
          if (next.fromItemId === next.toItemId) {
            return state;
          }
          return withBoard(state, {
            ...state.board,
            connectors: state.board.connectors.map((connector) =>
              connector.id === id ? next : connector,
            ),
          });
        });
      },

      selectConnector(id) {
        // アイテムとコネクタは同時に選ばない。操作の対象を一つに絞る。
        set({
          selectedConnectorId: id,
          selectedIds: id === null ? get().selectedIds : new Set<ItemId>(),
        });
      },

      removeSelectedConnector() {
        set((state) => {
          if (state.selectedConnectorId === null) {
            return state;
          }
          return {
            ...withBoard(
              state,
              removeConnectors(state.board, [state.selectedConnectorId]),
            ),
            selectedConnectorId: null,
          };
        });
      },

      toggleConnectorArrow(id) {
        set((state) => {
          const connectors = state.board.connectors.map((connector) =>
            connector.id === id
              ? { ...connector, arrow: !connector.arrow }
              : connector,
          );
          return withBoard(state, { ...state.board, connectors });
        });
      },

      removeConnector(id) {
        set((state) => withBoard(state, removeConnectors(state.board, [id])));
      },

      bringSelectedToFront() {
        reorder(bringToFront);
      },

      sendSelectedToBack() {
        reorder(sendToBack);
      },

      bringSelectedForward() {
        reorder(bringForward);
      },

      sendSelectedBackward() {
        reorder(sendBackward);
      },

      selectOnly(id) {
        set({ selectedIds: new Set([id]), selectedConnectorId: null });
      },

      toggleSelection(id) {
        set((state) => {
          const next = new Set(state.selectedIds);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return { selectedIds: next };
        });
      },

      selectMany(ids) {
        set({ selectedIds: new Set(ids), selectedConnectorId: null });
      },

      clearSelection() {
        set({ selectedIds: new Set<ItemId>(), selectedConnectorId: null });
      },

      selectedItems() {
        const { board, selectedIds } = get();
        return board.items.filter((item) => selectedIds.has(item.id));
      },
    };
  });
}

/** アプリケーションで共有するストア。 */
export const useBoardStore = createBoardStore();
