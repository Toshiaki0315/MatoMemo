/**
 * テキストアイテムのフォント設定パネル。
 *
 * テキストアイテムを 1 つだけ選んでいるときに現れる。
 */

import type { TextAlign, TextVerticalAlign } from "../domain/board";
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

      <FontControls item={item} onChange={onChange} />
    </div>
  );
}

/** 単体テキストだけに出すフォントの設定。 */
function FontControls({
  item,
  onChange,
}: {
  readonly item: TextEditableItem;
  readonly onChange: (item: TextEditableItem) => void;
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
          value={isAutoSize(item) ? AUTO_SIZE : String(item.fontSize)}
          onChange={(event) => onChange(withFontSize(item, event.target.value))}
        >
          {/* 自動は枠の中に文字を書く付箋・図形だけの設定。単体テキストは
              枠のほうが文章に合わせて伸びるので、大きさは常に固定 */}
          {item.type === "text" ? null : (
            <option value={AUTO_SIZE}>自動</option>
          )}
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

/** サイズの選択肢のうち「自動」を表す値。数値と重ならない文字列にする。 */
const AUTO_SIZE = "auto";

/** 文字の大きさが自動か。 */
function isAutoSize(item: TextEditableItem): boolean {
  return item.type !== "text" && item.fontSizeMode === "auto";
}

/**
 * サイズの選択を反映したアイテムを返す。
 * 数値を選んだら固定に切り替え、その大きさにする。
 */
function withFontSize(
  item: TextEditableItem,
  value: string,
): TextEditableItem {
  if (item.type === "text") {
    return { ...item, fontSize: Number(value) };
  }
  if (value === AUTO_SIZE) {
    return { ...item, fontSizeMode: "auto" };
  }
  return { ...item, fontSize: Number(value), fontSizeMode: "fixed" };
}
