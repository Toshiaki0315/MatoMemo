/**
 * 図形（矩形・円）の見た目の設定。
 *
 * 塗りと枠線は図形にだけある設定なので、テキストの設定とは分けている。
 */

import {
  STROKE_STYLES,
  STROKE_WIDTHS,
  type ShapeItem,
  type StrokeStyle,
} from "../domain/board";
import { FILL_COLORS } from "../render/palette";
import { STROKE_STYLE_LABELS } from "./ConnectorPropertiesPanel";

/** 塗りなしを表す選択肢の値。空文字は色として現れないので目印に使える。 */
const NO_FILL = "";

export interface ShapePropertiesPanelProps {
  readonly item: ShapeItem;
  readonly onChange: (item: ShapeItem) => void;
}

export function ShapePropertiesPanel({
  item,
  onChange,
}: ShapePropertiesPanelProps) {
  return (
    <div className="shape-properties" role="group" aria-label="図形の設定">
      <label>
        塗り
        <select
          value={item.fill ?? NO_FILL}
          onChange={(event) =>
            onChange({
              ...item,
              fill: event.target.value === NO_FILL ? null : event.target.value,
            })
          }
        >
          <option value={NO_FILL}>なし</option>
          {FILL_COLORS.map((color) => (
            <option key={color.value} value={color.value}>
              {color.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        枠線の太さ
        <select
          value={item.strokeWidth}
          onChange={(event) =>
            onChange({ ...item, strokeWidth: Number(event.target.value) })
          }
        >
          {STROKE_WIDTHS.map((width) => (
            <option key={width} value={width}>
              {width}
            </option>
          ))}
        </select>
      </label>

      <label>
        枠線の種類
        <select
          value={item.strokeStyle}
          onChange={(event) =>
            onChange({
              ...item,
              strokeStyle: event.target.value as StrokeStyle,
            })
          }
        >
          {STROKE_STYLES.map((style) => (
            <option key={style} value={style}>
              {STROKE_STYLE_LABELS[style]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
