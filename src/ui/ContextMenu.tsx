/**
 * アイテムを右クリックしたときに出る操作メニュー。
 *
 * 重なり順の変更と削除を提供する。
 */

import { useEffect, useState } from "react";

export interface ContextMenuAction {
  readonly label: string;
  readonly onSelect: () => void;
  /** 実行しても状態が変わらない場合に無効にする。 */
  readonly disabled?: boolean;
}

export interface ContextMenuProps {
  /** 画面座標での表示位置。 */
  readonly position: { readonly x: number; readonly y: number };
  readonly actions: readonly ContextMenuAction[];
  readonly onClose: () => void;
}

export function ContextMenu({ position, actions, onClose }: ContextMenuProps) {
  const [menu, setMenu] = useState<HTMLDivElement | null>(null);

  // メニューの外を触ったときと Escape で閉じる。
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (menu !== null && event.target instanceof Node && menu.contains(event.target)) {
        return;
      }
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menu, onClose]);

  return (
    <div
      ref={setMenu}
      className="context-menu"
      role="menu"
      aria-label="アイテムの操作"
      style={{ left: position.x, top: position.y }}
    >
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          role="menuitem"
          disabled={action.disabled ?? false}
          onClick={() => {
            action.onSelect();
            onClose();
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
