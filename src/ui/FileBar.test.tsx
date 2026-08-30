import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileBar } from "./FileBar";

function renderBar(overrides: Partial<Parameters<typeof FileBar>[0]> = {}) {
  const handlers = {
    onRename: vi.fn(),
    onNew: vi.fn(),
    onOpen: vi.fn(),
    onSave: vi.fn(),
    onSaveAs: vi.fn(),
    onExportMarkdown: vi.fn(),
  };
  render(
    <FileBar
      boardName="設計メモ"
      dirty={false}
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

describe("FileBar", () => {
  it("ボード名を表示する", () => {
    renderBar();
    expect(screen.getByLabelText("ボード名")).toHaveValue("設計メモ");
  });

  it("ボード名を編集すると通知する", () => {
    const { onRename } = renderBar();
    fireEvent.change(screen.getByLabelText("ボード名"), {
      target: { value: "会議メモ" },
    });
    expect(onRename).toHaveBeenCalledWith("会議メモ");
  });

  it("保存済みなら未保存の印を出さない", () => {
    renderBar();
    expect(screen.getByRole("status")).toHaveAccessibleName("保存済み");
  });

  it("未保存なら印を出す", () => {
    renderBar({ dirty: true });
    expect(screen.getByRole("status")).toHaveAccessibleName(
      "未保存の変更があります",
    );
  });

  it("各ボタンが通知する", () => {
    const handlers = renderBar();
    for (const [label, handler] of [
      ["新規", handlers.onNew],
      ["開く", handlers.onOpen],
      ["保存", handlers.onSave],
      ["別名で保存", handlers.onSaveAs],
      ["Markdown 出力", handlers.onExportMarkdown],
    ] as const) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(handler).toHaveBeenCalled();
    }
  });

  it("処理中はボタンを無効にする", () => {
    renderBar({ busy: true });
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "開く" })).toBeDisabled();
  });
});
