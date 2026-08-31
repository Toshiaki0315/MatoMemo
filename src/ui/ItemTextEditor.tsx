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
import { ITEM_TEXT_COLOR, SELECTION_COLOR } from "../render/palette";

/** テキストを内包できるアイテム。 */
export type TextEditableItem = StickyNoteItem | ShapeItem | TextItem;

/** 縦位置を flex の指定に読み替える。 */
const VERTICAL_ALIGN_TO_FLEX: Record<string, string> = {
  top: "flex-start",
  middle: "center",
  bottom: "flex-end",
};

const LINE_HEIGHT_RATIO = 1.4;
const TEXT_PADDING = 12;

export interface ItemTextEditorProps {
  readonly item: TextEditableItem;
  readonly viewport: Viewport;
  readonly onChangeText: (text: string) => void;
  /**
   * 内容がアイテムの高さに収まらなくなったときに呼ばれる（ワールド座標）。
   * テキストアイテムのみ。枠より外の文字は編集を終えると描かれないため、
   * 枠のほうを内容に合わせて広げる。
   */
  readonly onGrowHeight?: (height: number) => void;
  readonly onClose: () => void;
}

export function ItemTextEditor({
  item,
  viewport,
  onChangeText,
  onGrowHeight,
  onClose,
}: ItemTextEditorProps) {
  const [textarea, setTextarea] = useState<HTMLTextAreaElement | null>(null);

  const isStandaloneText = item.type === "text";
  const topLeft = toScreen(viewport, { x: item.x, y: item.y });
  const { fontSize, fontFamily } = item;

  /**
   * 開いた直後に入力できるようフォーカスし、カーソルを末尾に置く。
   *
   * 全選択にすると、既存の文章に書き足したいときに最初の一打で消えてしまう。
   * 末尾に置けば、続きを打つのも選び直して消すのもできる。
   */
  useEffect(() => {
    if (textarea === null) {
      return;
    }
    textarea.focus();
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
  }, [textarea]);

  // 内容に合わせて高さを変え、中央寄せが正しく見えるようにする。
  // 空でもカーソルが見えるよう、最低 1 行分の高さは確保する。
  useEffect(() => {
    if (textarea === null) {
      return;
    }
    textarea.style.height = "auto";
    const lineHeight = fontSize * viewport.scale * LINE_HEIGHT_RATIO;
    const contentHeight = Math.max(textarea.scrollHeight, lineHeight);
    textarea.style.height = `${contentHeight}px`;

    // テキストアイテムは枠の高さを内容に合わせて広げる。付箋・図形は
    // 枠の大きさが主役なので広げず、収まらない分は描画側が省略する。
    if (isStandaloneText) {
      const required = contentHeight / viewport.scale;
      if (required > item.height) {
        onGrowHeight?.(required);
      }
    }
  }, [
    textarea,
    item.text,
    item.height,
    fontSize,
    viewport.scale,
    isStandaloneText,
    onGrowHeight,
  ]);

  return (
    <div
      className="item-text-editor"
      style={{
        left: topLeft.x,
        top: topLeft.y,
        width: item.width * viewport.scale,
        height: item.height * viewport.scale,
        // 描画側と同じ配置にする
        alignItems: VERTICAL_ALIGN_TO_FLEX[item.verticalAlign],
        padding: isStandaloneText ? 0 : TEXT_PADDING * viewport.scale,
      }}
    >
      <textarea
        ref={setTextarea}
        aria-label="アイテムのテキスト"
        // 空のときはカーソルだけでは編集中と分かりにくいので、
        // 打ち込む場所であることを言葉でも示す
        placeholder="入力"
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
          textAlign: item.align,
          color: ITEM_TEXT_COLOR,
          // 付箋の淡い色の上でも見えるよう、カーソルの色を明示する
          caretColor: SELECTION_COLOR,
        }}
      />
    </div>
  );
}
