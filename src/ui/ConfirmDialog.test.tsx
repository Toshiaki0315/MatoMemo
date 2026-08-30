import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

function renderDialog(cancelLabel?: string) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      message="保存していない変更があります。破棄しますか？"
      confirmLabel="破棄して続行"
      {...(cancelLabel === undefined ? {} : { cancelLabel })}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  it("メッセージを表示する", () => {
    renderDialog();
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "保存していない変更があります。破棄しますか？",
    );
  });

  it("決定ボタンにフォーカスする", () => {
    renderDialog();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "破棄して続行" }),
    );
  });

  it("決定すると通知する", () => {
    const { onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "破棄して続行" }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("取り消すと通知する", () => {
    const { onCancel } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("Escape で取り消す", () => {
    const { onCancel } = renderDialog();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });

  it("他のキーでは何も起きない", () => {
    const { onCancel, onConfirm } = renderDialog();
    fireEvent.keyDown(window, { key: "a" });
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("取り消しのラベルを変えられる", () => {
    renderDialog("やめる");
    expect(screen.getByRole("button", { name: "やめる" })).toBeInTheDocument();
  });
});
