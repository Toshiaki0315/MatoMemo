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
import { createBoard, type Board, type Item, type ItemId } from "../domain/board";
import {
  addItem as addItemToBoard,
  moveItems,
  removeItems,
  replaceItem as replaceItemInBoard,
} from "../domain/boardOps";
import { createId as defaultCreateId } from "../domain/ids";
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
  moveSelected(dx: number, dy: number): void;
  removeSelected(): void;

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

    moveSelected(dx, dy) {
      set((state) => ({
        board: moveItems(state.board, [...state.selectedIds], dx, dy),
      }));
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

/** アプリケーションで共有するストア。 */
export const useBoardStore = createBoardStore();
