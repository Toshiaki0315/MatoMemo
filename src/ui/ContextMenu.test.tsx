import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContextMenu, type ContextMenuAction } from "./ContextMenu";

function renderMenu(actions: ContextMenuAction[]) {
  const onClose = vi.fn();
  render(
    <ContextMenu
      position={{ x: 120, y: 80 }}
      actions={actions}
      onClose={onClose}
    />,
  );
  return { onClose };
}

describe("ContextMenu", () => {
  it("項目を並べる", () => {
    renderMenu([
      { label: "最前面へ", onSelect: vi.fn() },
      { label: "最背面へ", onSelect: vi.fn() },
    ]);
    expect(screen.getAllByRole("menuitem")).toHaveLength(2);
  });

  it("指定した位置に表示する", () => {
    renderMenu([{ label: "最前面へ", onSelect: vi.fn() }]);
    const menu = screen.getByRole("menu");
    expect(menu.style.left).toBe("120px");
    expect(menu.style.top).toBe("80px");
  });

  it("項目を選ぶと実行して閉じる", () => {
    const onSelect = vi.fn();
    const { onClose } = renderMenu([{ label: "最前面へ", onSelect }]);
    fireEvent.click(screen.getByRole("menuitem", { name: "最前面へ" }));
    expect(onSelect).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("無効な項目は押せない", () => {
    const onSelect = vi.fn();
    renderMenu([{ label: "最前面へ", onSelect, disabled: true }]);
    const item = screen.getByRole("menuitem", { name: "最前面へ" });
    expect(item).toBeDisabled();
    fireEvent.click(item);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("メニューの外を触ると閉じる", () => {
    const { onClose } = renderMenu([{ label: "最前面へ", onSelect: vi.fn() }]);
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it("メニューの中を触っても閉じない", () => {
    const { onClose } = renderMenu([{ label: "最前面へ", onSelect: vi.fn() }]);
    fireEvent.pointerDown(screen.getByRole("menuitem", { name: "最前面へ" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Escape で閉じる", () => {
    const { onClose } = renderMenu([{ label: "最前面へ", onSelect: vi.fn() }]);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("他のキーでは閉じない", () => {
    const { onClose } = renderMenu([{ label: "最前面へ", onSelect: vi.fn() }]);
    fireEvent.keyDown(window, { key: "a" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("要素以外が対象のポインタ操作でも閉じる", () => {
    const { onClose } = renderMenu([{ label: "最前面へ", onSelect: vi.fn() }]);
    window.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(onClose).toHaveBeenCalled();
  });
});
