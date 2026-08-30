/**
 * テキストアイテムのフォント設定パネル。
 *
 * テキストアイテムを 1 つだけ選んでいるときに現れる。
 */

import type {
  TextAlign,
  TextVerticalAlign,
  TextItem,
} from "../domain/board";
import type { TextEditableItem } from "./ItemTextEditor";

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

/** 横位置の表示名。 */
const ALIGN_LABELS: Record<TextAlign, string> = {
  left: "左",
  center: "中央",
  right: "右",
};

/** 縦位置の表示名。 */
const VERTICAL_ALIGN_LABELS: Record<TextVerticalAlign, string> = {
  top: "上",
  middle: "中央",
  bottom: "下",
};

export interface TextPropertiesPanelProps {
  readonly item: TextEditableItem;
  /**
   * 設定を変えたアイテムを渡す。
   *
   * 項目ごとにコールバックを分けると、種類によって呼ばれないものが出て
   * 使われない分岐が残る。更新後のアイテムを一本の口で返す形にしている。
   */
  readonly onChange: (item: TextEditableItem) => void;
}

export function TextPropertiesPanel({
  item,
  onChange,
}: TextPropertiesPanelProps) {
  // フォントの設定は単体テキストにだけ意味がある。
  // 付箋や図形の内部テキストは書式を揃えたいので固定している。
  const font = item.type === "text" ? (item as TextItem) : null;

  return (
    <div className="text-properties" role="group" aria-label="テキストの設定">
      <label>
        横位置
        <select
          value={item.align}
          onChange={(event) =>
            onChange({ ...item, align: event.target.value as TextAlign })
          }
        >
          {(Object.keys(ALIGN_LABELS) as TextAlign[]).map((align) => (
            <option key={align} value={align}>
              {ALIGN_LABELS[align]}
            </option>
          ))}
        </select>
      </label>

      <label>
        縦位置
        <select
          value={item.verticalAlign}
          onChange={(event) =>
            onChange({
              ...item,
              verticalAlign: event.target.value as TextVerticalAlign,
            })
          }
        >
          {(Object.keys(VERTICAL_ALIGN_LABELS) as TextVerticalAlign[]).map(
            (value) => (
              <option key={value} value={value}>
                {VERTICAL_ALIGN_LABELS[value]}
              </option>
            ),
          )}
        </select>
      </label>

      {font === null ? null : <FontControls item={font} onChange={onChange} />}
    </div>
  );
}

/** 単体テキストだけに出すフォントの設定。 */
function FontControls({
  item,
  onChange,
}: {
  readonly item: TextItem;
  readonly onChange: (item: TextItem) => void;
}) {
  return (
    <>
      <label>
        フォント
        <select
          value={item.fontFamily}
          onChange={(event) =>
            onChange({ ...item, fontFamily: event.target.value })
          }
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
          onChange={(event) =>
            onChange({ ...item, fontSize: Number(event.target.value) })
          }
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
    </>
  );
}
