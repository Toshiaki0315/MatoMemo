/**
 * アイテム内のテキストを編集するオーバーレイ。
 *
 * Canvas 上に文字入力欄を重ねる。Canvas 自体には入力機能がなく、
 * 日本語入力 (IME) を扱うには本物の入力要素が必要なため、編集中だけ
 * `<textarea>` をアイテムと同じ位置・大きさで重ねている。
 */

import { useEffect, useState } from "react";
import type { ShapeItem, StickyNoteItem, TextItem } from "../domain/board";
import { toScreen, type Viewport } from "../domain/viewport";
import { ITEM_TEXT_COLOR } from "../render/palette";

/** テキストを内包できるアイテム。 */
export type TextEditableItem = StickyNoteItem | ShapeItem | TextItem;

/** 付箋・図形の内部テキストのフォント（描画側と揃える）。 */
const ITEM_FONT_SIZE = 16;
const ITEM_FONT_FAMILY = "Hiragino Sans";
const LINE_HEIGHT_RATIO = 1.4;
const TEXT_PADDING = 12;

export interface ItemTextEditorProps {
  readonly item: TextEditableItem;
  readonly viewport: Viewport;
  readonly onChangeText: (text: string) => void;
  readonly onClose: () => void;
}

export function ItemTextEditor({
  item,
  viewport,
  onChangeText,
  onClose,
}: ItemTextEditorProps) {
  const [textarea, setTextarea] = useState<HTMLTextAreaElement | null>(null);

  // 開いた直後に入力できるようフォーカスし、全選択して置き換えやすくする。
  useEffect(() => {
    if (textarea === null) {
      return;
    }
    textarea.focus();
    textarea.select();
  }, [textarea]);

  // 内容に合わせて高さを変え、中央寄せが正しく見えるようにする。
  useEffect(() => {
    if (textarea === null) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [textarea, item.text]);

  const isStandaloneText = item.type === "text";
  const topLeft = toScreen(viewport, { x: item.x, y: item.y });
  const fontSize = isStandaloneText ? item.fontSize : ITEM_FONT_SIZE;
  const fontFamily = isStandaloneText ? item.fontFamily : ITEM_FONT_FAMILY;

  return (
    <div
      className="item-text-editor"
      style={{
        left: topLeft.x,
        top: topLeft.y,
        width: item.width * viewport.scale,
        height: item.height * viewport.scale,
        // 単体テキストは上寄せ、付箋・図形は中央寄せで描画側と揃える
        alignItems: isStandaloneText ? "flex-start" : "center",
        padding: isStandaloneText ? 0 : TEXT_PADDING * viewport.scale,
      }}
    >
      <textarea
        ref={setTextarea}
        aria-label="アイテムのテキスト"
        value={item.text}
        onChange={(event) => onChangeText(event.target.value)}
        onBlur={onClose}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onClose();
          }
        }}
        style={{
          fontSize: fontSize * viewport.scale,
          fontFamily: `"${fontFamily}", sans-serif`,
          lineHeight: LINE_HEIGHT_RATIO,
          textAlign: isStandaloneText ? "left" : "center",
          color: ITEM_TEXT_COLOR,
        }}
      />
    </div>
  );
}
