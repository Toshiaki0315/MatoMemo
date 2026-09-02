/**
 * アイテムを追加するツールバー。
 *
 * 追加位置は「今見えている領域の中央」にする。画面外に追加されると
 * ユーザーが見失うため。
 */

import {
  STICKY_COLORS,
  type ConnectorKind,
  type ShapeKind,
  type StickyColor,
} from "../domain/board";
import { STICKY_PALETTE } from "../render/palette";

export interface ToolbarProps {
  readonly onAddSticky: (color: StickyColor) => void;
  readonly onAddShape: (shape: ShapeKind) => void;
  readonly onAddText: () => void;
  readonly onAddImage: () => void;
  readonly canDelete: boolean;
  readonly onDeleteSelected: () => void;
  readonly connectMode: boolean;
  readonly onToggleConnectMode: () => void;
  readonly connectorKind: ConnectorKind;
  readonly onChangeConnectorKind: (kind: ConnectorKind) => void;
  readonly connectorArrows: ConnectorArrows;
  readonly onChangeConnectorArrows: (arrows: ConnectorArrows) => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
}

/** 新しい線に付ける矢印の指定。 */
export type ConnectorArrows = "none" | "end" | "start" | "both";

/** 矢印の指定の表示名。 */
const ARROW_LABELS: Record<ConnectorArrows, string> = {
  none: "なし",
  end: "終点",
  start: "始点",
  both: "両端",
};

/** コネクタの種類の表示名。 */
const CONNECTOR_LABELS: Record<ConnectorKind, string> = {
  straight: "直線",
  polyline: "折れ線",
  curved: "曲線",
};

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
  connectMode,
  onToggleConnectMode,
  connectorKind,
  onChangeConnectorKind,
  connectorArrows,
  onChangeConnectorArrows,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: ToolbarProps) {
  return (
    <div className="toolbar" role="toolbar" aria-label="アイテムの追加">
      <div className="toolbar-group">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="元に戻す"
          title="元に戻す (⌘Z)"
        >
          ↩
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="やり直す"
          title="やり直す (⇧⌘Z)"
        >
          ↪
        </button>
      </div>

      <div className="toolbar-separator" />

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
        <button type="button" onClick={() => onAddShape("rounded")}>
          角丸
        </button>
        <button type="button" onClick={() => onAddShape("circle")}>
          円
        </button>
        <button type="button" onClick={() => onAddShape("line")}>
          直線
        </button>
        <button type="button" onClick={onAddText}>
          テキスト
        </button>
        <button type="button" onClick={onAddImage}>
          画像
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button
          type="button"
          className={connectMode ? "is-active" : ""}
          aria-pressed={connectMode}
          onClick={onToggleConnectMode}
        >
          接続
        </button>
        <label className="connector-kind">
          <span className="visually-hidden">線の種類</span>
          <select
            aria-label="線の種類"
            value={connectorKind}
            onChange={(event) =>
              onChangeConnectorKind(event.target.value as ConnectorKind)
            }
          >
            {(Object.keys(CONNECTOR_LABELS) as ConnectorKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {CONNECTOR_LABELS[kind]}
              </option>
            ))}
          </select>
        </label>
        <label className="connector-arrow">
          <span className="visually-hidden">矢印</span>
          <select
            aria-label="矢印"
            value={connectorArrows}
            onChange={(event) =>
              onChangeConnectorArrows(event.target.value as ConnectorArrows)
            }
          >
            {(Object.keys(ARROW_LABELS) as ConnectorArrows[]).map((value) => (
              <option key={value} value={value}>
                矢印: {ARROW_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="toolbar-separator" />

      <button type="button" onClick={onDeleteSelected} disabled={!canDelete}>
        削除
      </button>
    </div>
  );
}
