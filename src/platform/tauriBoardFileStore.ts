/**
 * Tauri を用いた `BoardFileStore` 実装。
 *
 * `@tauri-apps/plugin-fs` と `@tauri-apps/plugin-dialog` への依存を
 * このファイルだけに閉じ込める。アプリの他の部分は `BoardFileStore`
 * インタフェースにのみ依存する。
 */

import { invoke } from "@tauri-apps/api/core";
import {
  open as openDialog,
  save as saveDialog,
} from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import type { Board } from "../domain/board";
import { parseBoardFile, serializeBoard } from "../domain/serialize";
import {
  BOARD_FILE_FILTER,
  StorageError,
  suggestFileName,
  type BoardFileStore,
  type OpenedBoard,
} from "./boardFileStore";

/** ダイアログのフィルタ設定。plugin-dialog が要求する可変配列に変換する。 */
const DIALOG_FILTERS = [
  { name: BOARD_FILE_FILTER.name, extensions: [...BOARD_FILE_FILTER.extensions] },
];

/**
 * 一時ファイルに書いてから rename で置き換える保存（Rust 側のコマンド）。
 *
 * `writeTextFile` は保存先を直接上書きするため、書き込みが途中で失敗すると
 * 元の内容まで失われる。既存のファイルを壊さないよう、書き込みはすべて
 * こちらを使う。
 */
async function writeTextFileAtomic(
  path: string,
  contents: string,
): Promise<void> {
  await invoke("write_text_file_atomic", { path, contents });
}

export function createTauriBoardFileStore(): BoardFileStore {
  async function load(path: string): Promise<Board> {
    let text: string;
    try {
      text = await readTextFile(path);
    } catch (cause) {
      throw new StorageError(`ファイルを読み込めませんでした: ${path}`, cause);
    }
    // 内容の不正は BoardFileError として呼び出し元に伝える（I/O の失敗とは区別する）
    return parseBoardFile(text);
  }

  async function save(path: string, board: Board): Promise<void> {
    try {
      await writeTextFileAtomic(path, serializeBoard(board));
    } catch (cause) {
      throw new StorageError(`ファイルを保存できませんでした: ${path}`, cause);
    }
  }

  return {
    load,
    save,

    async open(): Promise<OpenedBoard | null> {
      let path: string | null;
      try {
        path = await openDialog({
          multiple: false,
          directory: false,
          filters: DIALOG_FILTERS,
        });
      } catch (cause) {
        throw new StorageError("ファイルを開くダイアログを表示できませんでした。", cause);
      }
      if (path === null) {
        return null;
      }
      return { path, board: await load(path) };
    },

    async saveAs(board: Board): Promise<string | null> {
      let path: string | null;
      try {
        path = await saveDialog({
          defaultPath: suggestFileName(board.name),
          filters: DIALOG_FILTERS,
        });
      } catch (cause) {
        throw new StorageError("保存先ダイアログを表示できませんでした。", cause);
      }
      if (path === null) {
        return null;
      }
      await save(path, board);
      return path;
    },

    async exportText(text, suggestedName, filter) {
      let path: string | null;
      try {
        path = await saveDialog({
          defaultPath: suggestedName,
          filters: [
            { name: filter.name, extensions: [...filter.extensions] },
          ],
        });
      } catch (cause) {
        throw new StorageError(
          "書き出し先ダイアログを表示できませんでした。",
          cause,
        );
      }
      if (path === null) {
        return null;
      }
      try {
        await writeTextFileAtomic(path, text);
      } catch (cause) {
        throw new StorageError(`ファイルを書き出せませんでした: ${path}`, cause);
      }
      return path;
    },
  };
}
