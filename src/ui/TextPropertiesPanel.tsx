/**
 * テキストアイテムのフォント設定パネル。
 *
 * テキストアイテムを 1 つだけ選んでいるときに現れる。
 */

import type { TextItem } from "../domain/board";

/** 選べるフォント。macOS に標準で入っているものに絞る。 */
export const FONT_FAMILIES = [
  "Hiragino Sans",
  "Hiragino Mincho ProN",
  "Hiragino Maru Gothic ProN",
  "Helvetica Neue",
  "Menlo",
] as const;

/** 選べるフォントサイズ。 */
export const FONT_SIZES = [12, 14, 16, 20, 24, 32, 48, 64] as const;

export interface TextPropertiesPanelProps {
  readonly item: TextItem;
  readonly onChangeFontFamily: (fontFamily: string) => void;
  readonly onChangeFontSize: (fontSize: number) => void;
}

export function TextPropertiesPanel({
  item,
  onChangeFontFamily,
  onChangeFontSize,
}: TextPropertiesPanelProps) {
  return (
    <div className="text-properties" role="group" aria-label="テキストの設定">
      <label>
        フォント
        <select
          value={item.fontFamily}
          onChange={(event) => onChangeFontFamily(event.target.value)}
        >
          {/* 保存ファイルには任意のフォント名が入りうるため、
              一覧にない値も選択肢として補う */}
          {(FONT_FAMILIES as readonly string[]).includes(item.fontFamily)
            ? null
            : <option value={item.fontFamily}>{item.fontFamily}</option>}
          {FONT_FAMILIES.map((family) => (
            <option key={family} value={family}>
              {family}
            </option>
          ))}
        </select>
      </label>

      <label>
        サイズ
        <select
          value={item.fontSize}
          onChange={(event) => onChangeFontSize(Number(event.target.value))}
        >
          {(FONT_SIZES as readonly number[]).includes(item.fontSize) ? null : (
            <option value={item.fontSize}>{item.fontSize}</option>
          )}
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
