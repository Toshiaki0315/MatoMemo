/**
 * 画像ファイルの選択と読み込み（Tauri 依存部分）。
 */

import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { IMAGE_EXTENSIONS } from "../domain/image/imageFormat";
import { StorageError } from "./boardFileStore";
import {
  importImageBytes,
  type ImportImageOptions,
  type ImportedImage,
} from "./imageImport";

/** 画像を選ばせて取り込む。キャンセルされた場合は null。 */
export type ImagePicker = (
  options?: ImportImageOptions,
) => Promise<ImportedImage | null>;

export const pickImage: ImagePicker = async (options) => {
  let path: string | null;
  try {
    path = await openDialog({
      multiple: false,
      directory: false,
      filters: [{ name: "画像", extensions: [...IMAGE_EXTENSIONS] }],
    });
  } catch (cause) {
    throw new StorageError("画像を開くダイアログを表示できませんでした。", cause);
  }
  if (path === null) {
    return null;
  }

  let bytes: Uint8Array;
  try {
    bytes = await readFile(path);
  } catch (cause) {
    throw new StorageError(`画像を読み込めませんでした: ${path}`, cause);
  }
  return importImageBytes(bytes, options);
};
