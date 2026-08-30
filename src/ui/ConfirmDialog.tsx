/**
 * 確認ダイアログ。
 *
 * `window.confirm` ではなくアプリ内で描くことで、見た目を揃えられるうえ、
 * プラットフォーム依存の API をテストから切り離せる。
 */

import { useEffect, useState } from "react";

export interface ConfirmDialogProps {
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ConfirmDialog({
  message,
  confirmLabel,
  cancelLabel = "キャンセル",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [confirmButton, setConfirmButton] = useState<HTMLButtonElement | null>(
    null,
  );

  // 開いた直後に Enter で決定できるようフォーカスする。
  useEffect(() => {
    confirmButton?.focus();
  }, [confirmButton]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="alertdialog" aria-label={message}>
        <p>{message}</p>
        <div className="dialog-actions">
          <button type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={setConfirmButton}
            type="button"
            className="is-primary"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
