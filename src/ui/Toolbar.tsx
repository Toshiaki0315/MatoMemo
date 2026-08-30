/**
 * アイテムを追加するツールバー。
 *
 * 追加位置は「今見えている領域の中央」にする。画面外に追加されると
 * ユーザーが見失うため。
 */

import { STICKY_COLORS, type ShapeKind, type StickyColor } from "../domain/board";
import { STICKY_PALETTE } from "../render/palette";

export interface ToolbarProps {
  readonly onAddSticky: (color: StickyColor) => void;
  readonly onAddShape: (shape: ShapeKind) => void;
  readonly onAddText: () => void;
  readonly onAddImage: () => void;
  readonly canDelete: boolean;
  readonly onDeleteSelected: () => void;
}

/** 付箋の色の日本語名。 */
const COLOR_LABELS: Record<StickyColor, string> = {
  yellow: "黄色",
  orange: "オレンジ",
  pink: "ピンク",
  purple: "紫",
  blue: "青",
  green: "緑",
};

export function Toolbar({
  onAddSticky,
  onAddShape,
  onAddText,
  onAddImage,
  canDelete,
  onDeleteSelected,
}: ToolbarProps) {
  return (
    <div className="toolbar" role="toolbar" aria-label="アイテムの追加">
      <div className="toolbar-group" role="group" aria-label="付箋を追加">
        {STICKY_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className="swatch"
            style={{
              backgroundColor: STICKY_PALETTE[color].fill,
              borderColor: STICKY_PALETTE[color].border,
            }}
            aria-label={`${COLOR_LABELS[color]}の付箋を追加`}
            onClick={() => onAddSticky(color)}
          />
        ))}
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button type="button" onClick={() => onAddShape("rectangle")}>
          矩形
        </button>
        <button type="button" onClick={() => onAddShape("circle")}>
          円
        </button>
        <button type="button" onClick={onAddText}>
          テキスト
        </button>
        <button type="button" onClick={onAddImage}>
          画像
        </button>
      </div>

      <div className="toolbar-separator" />

      <button type="button" onClick={onDeleteSelected} disabled={!canDelete}>
        削除
      </button>
    </div>
  );
}
