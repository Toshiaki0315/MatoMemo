/**
 * ボードの永続化に関するプラットフォーム抽象。
 *
 * ここでは「何ができるか」だけを定義し、Tauri など具体的な手段には依存しない。
 * アプリ本体はこのインタフェースにのみ依存させ、テストではインメモリ実装
 * (`createMemoryBoardFileStore`) に差し替えられるようにする。
 */

import type { Board } from "../domain/board";
import { BOARD_FILE_EXTENSION } from "../domain/serialize";

/** ファイルダイアログで使うフィルタ。 */
export const BOARD_FILE_FILTER = {
  name: "MatoMemo ボード",
  extensions: [BOARD_FILE_EXTENSION],
} as const;

/** ファイル名に使えない文字。macOS の `/` に加え、他 OS へ持ち出す場合も考慮する。 */
const UNSAFE_FILENAME_CHARS = /[/\\:*?"<>|]/g;

/** ファイル名の最大長（拡張子を除く）。 */
const MAX_FILE_NAME_LENGTH = 80;

/** 既定のファイル名（ボード名が空の場合）。 */
const FALLBACK_FILE_NAME = "board";

/** 開いたボードとその保存先。 */
export interface OpenedBoard {
  readonly path: string;
  readonly board: Board;
}

/**
 * ファイル入出力の失敗を表すエラー。
 *
 * ファイルの内容が不正な場合は `BoardFileError` が投げられる。
 * こちらは読み書きそのものが失敗した場合（権限不足、ディスク不足など）に使う。
 */
export class StorageError extends Error {
  override readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "StorageError";
    this.cause = cause;
  }
}

/** Markdown 書き出し用のフィルタ。 */
export const MARKDOWN_FILE_FILTER = {
  name: "Markdown",
  extensions: ["md"],
} as const;

/** ボードの読み書きを行う。 */
export interface BoardFileStore {
  /** 開くダイアログを表示して読み込む。キャンセルされた場合は null。 */
  open(): Promise<OpenedBoard | null>;
  /** パスを指定して読み込む。 */
  load(path: string): Promise<Board>;
  /** パスを指定して保存する。 */
  save(path: string, board: Board): Promise<void>;
  /** 保存先ダイアログを表示して保存する。キャンセルされた場合は null。 */
  saveAs(board: Board): Promise<string | null>;
  /**
   * 書き出し先を尋ねてテキストを保存する。キャンセルされた場合は null。
   * Markdown の書き出しに使う。
   */
  exportText(
    text: string,
    suggestedName: string,
    filter: { readonly name: string; readonly extensions: readonly string[] },
  ): Promise<string | null>;
}

/** ボード名から保存ダイアログの既定ファイル名を作る。 */
export function suggestFileName(
  boardName: string,
  extension: string = BOARD_FILE_EXTENSION,
): string {
  const sanitized = boardName
    .replace(UNSAFE_FILENAME_CHARS, "-")
    .trim()
    .slice(0, MAX_FILE_NAME_LENGTH);
  const base = sanitized.length > 0 ? sanitized : FALLBACK_FILE_NAME;
  return `${base}.${extension}`;
}
