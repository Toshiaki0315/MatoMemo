/**
 * インメモリの `BoardFileStore` 実装。
 *
 * テストと、ファイルシステムを触りたくない場面（プレビュー等）で使う。
 * ダイアログの結果は `openPath` / `savePath` に事前設定した値を返すことで模倣する。
 */

import type { Board } from "../domain/board";
import { parseBoardFile, serializeBoard } from "../domain/serialize";
import {
  StorageError,
  type BoardFileStore,
  type OpenedBoard,
} from "./boardFileStore";

export interface MemoryBoardFileStore extends BoardFileStore {
  /** パスから保存内容へのマップ。テストから内容を確認・投入できる。 */
  readonly files: Map<string, string>;
  /** `open()` が返すパス。null ならキャンセル扱い。 */
  openPath: string | null;
  /** `saveAs()` が返すパス。null ならキャンセル扱い。 */
  savePath: string | null;
  /** `exportText()` が返すパス。null ならキャンセル扱い。 */
  exportPath: string | null;
}

export interface MemoryBoardFileStoreOptions {
  /** 初期状態で存在するファイル（パス → JSON 文字列）。 */
  readonly files?: Readonly<Record<string, string>>;
  readonly openPath?: string | null;
  readonly savePath?: string | null;
  readonly exportPath?: string | null;
}

export function createMemoryBoardFileStore(
  options: MemoryBoardFileStoreOptions = {},
): MemoryBoardFileStore {
  const store: MemoryBoardFileStore = {
    files: new Map(Object.entries(options.files ?? {})),
    openPath: options.openPath ?? null,
    savePath: options.savePath ?? null,
    exportPath: options.exportPath ?? null,

    async load(path: string): Promise<Board> {
      const text = store.files.get(path);
      if (text === undefined) {
        throw new StorageError(`ファイルが見つかりません: ${path}`);
      }
      return parseBoardFile(text);
    },

    async save(path: string, board: Board): Promise<void> {
      store.files.set(path, serializeBoard(board));
    },

    async open(): Promise<OpenedBoard | null> {
      if (store.openPath === null) {
        return null;
      }
      const path = store.openPath;
      return { path, board: await store.load(path) };
    },

    async saveAs(board: Board): Promise<string | null> {
      if (store.savePath === null) {
        return null;
      }
      const path = store.savePath;
      await store.save(path, board);
      return path;
    },

    async exportText(text: string): Promise<string | null> {
      if (store.exportPath === null) {
        return null;
      }
      store.files.set(store.exportPath, text);
      return store.exportPath;
    },
  };

  return store;
}
