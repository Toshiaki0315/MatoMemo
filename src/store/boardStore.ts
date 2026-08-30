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
import {
  bringForward,
  bringToFront,
  sendBackward,
  sendToBack,
} from "../domain/zorder";
import { createViewport, type Viewport } from "../domain/viewport";

export interface BoardState {
  readonly board: Board;
  readonly viewport: Viewport;
  /** 選択中のアイテム id。 */
  readonly selectedIds: ReadonlySet<ItemId>;

  setViewport(viewport: Viewport): void;

  /**
   * id を採番してアイテムを追加し、そのアイテムを選択状態にする。
   * @param create 採番された id を受け取ってアイテムを組み立てる関数
   * @returns 追加したアイテムの id
   */
  addItem(create: (id: ItemId) => Item): ItemId;
  replaceItem(item: Item): void;

  /**
   * アイテム同士を結ぶコネクタを追加する。
   * 同じ組み合わせが既にある場合や自分自身への接続は追加しない。
   * @returns 追加した場合は id、追加しなかった場合は null
   */
  connectItems(
    fromItemId: ItemId,
    toItemId: ItemId,
    kind: ConnectorKind,
  ): ConnectorId | null;
  removeConnector(id: ConnectorId): void;
  moveSelected(dx: number, dy: number): void;
  /**
   * アイテムをリサイズする。画像は原寸の縦横比を必ず保つ。
   * @param dx ハンドルの移動量（ワールド座標）
   */
  resizeItem(id: ItemId, handle: ResizeHandle, dx: number, dy: number): void;
  removeSelected(): void;

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

export function createBoardStore(options: BoardStoreOptions = {}): BoardStore {
  const createId = options.createId ?? defaultCreateId;

  return create<BoardState>()((set, get) => ({
    board: createBoard({ id: createId() }),
    viewport: createViewport(),
    selectedIds: new Set<ItemId>(),

    setViewport(viewport) {
      set({ viewport });
    },

    addItem(create) {
      const id = createId();
      set((state) => ({
        board: addItemToBoard(state.board, create(id)),
        // 追加直後は続けて編集・移動することが多いため選択状態にする
        selectedIds: new Set([id]),
      }));
      return id;
    },

    replaceItem(item) {
      set((state) => ({ board: replaceItemInBoard(state.board, item) }));
    },

    connectItems(fromItemId, toItemId, kind) {
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
      set({
        board: addConnectorToBoard(
          board,
          createConnector({ id, fromItemId, toItemId, kind }),
        ),
      });
      return id;
    },

    removeConnector(id) {
      set((state) => ({ board: removeConnectors(state.board, [id]) }));
    },

    moveSelected(dx, dy) {
      set((state) => ({
        board: moveItems(state.board, [...state.selectedIds], dx, dy),
      }));
    },

    resizeItem(id, handle, dx, dy) {
      set((state) => {
        const item = state.board.items.find((candidate) => candidate.id === id);
        if (item === undefined) {
          return state;
        }
        // 画像は縦横比を維持する。原寸の比を基準にすることで、
        // 何度リサイズしても元の比から少しずつずれていくことがない。
        const options =
          item.type === "image"
            ? { aspectRatio: item.naturalWidth / item.naturalHeight }
            : {};
        const bounds = resizeRect(
          { x: item.x, y: item.y, width: item.width, height: item.height },
          handle,
          dx,
          dy,
          options,
        );
        return {
          board: replaceItemInBoard(state.board, { ...item, ...bounds }),
        };
      });
    },

    removeSelected() {
      set((state) => {
        if (state.selectedIds.size === 0) {
          return state;
        }
        return {
          board: removeItems(state.board, [...state.selectedIds]),
          selectedIds: new Set<ItemId>(),
        };
      });
    },

    bringSelectedToFront() {
      set((state) => reorder(state, bringToFront));
    },

    sendSelectedToBack() {
      set((state) => reorder(state, sendToBack));
    },

    bringSelectedForward() {
      set((state) => reorder(state, bringForward));
    },

    sendSelectedBackward() {
      set((state) => reorder(state, sendBackward));
    },

    selectOnly(id) {
      set({ selectedIds: new Set([id]) });
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
      set({ selectedIds: new Set(ids) });
    },

    clearSelection() {
      set({ selectedIds: new Set<ItemId>() });
    },

    selectedItems() {
      const { board, selectedIds } = get();
      return board.items.filter((item) => selectedIds.has(item.id));
    },
  }));
}

/** 重なり順の操作を適用する。並びが変わらない場合は状態をそのまま返す。 */
function reorder(
  state: BoardState,
  operation: (
    items: readonly Item[],
    ids: readonly ItemId[],
  ) => readonly Item[],
): Partial<BoardState> | BoardState {
  const items = operation(state.board.items, [...state.selectedIds]);
  if (items === state.board.items) {
    return state;
  }
  return { board: { ...state.board, items } };
}

/** アプリケーションで共有するストア。 */
export const useBoardStore = createBoardStore();
