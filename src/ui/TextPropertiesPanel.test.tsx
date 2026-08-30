import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createText } from "../domain/board";
import {
  FONT_FAMILIES,
  FONT_SIZES,
  TextPropertiesPanel,
} from "./TextPropertiesPanel";

function renderPanel(item = createText({ id: "t", x: 0, y: 0 })) {
  const onChangeFontFamily = vi.fn();
  const onChangeFontSize = vi.fn();
  render(
    <TextPropertiesPanel
      item={item}
      onChangeFontFamily={onChangeFontFamily}
      onChangeFontSize={onChangeFontSize}
    />,
  );
  return {
    fontSelect: screen.getByLabelText("フォント") as HTMLSelectElement,
    sizeSelect: screen.getByLabelText("サイズ") as HTMLSelectElement,
    onChangeFontFamily,
    onChangeFontSize,
  };
}

describe("TextPropertiesPanel", () => {
  it("現在のフォントを選択状態にする", () => {
    expect(renderPanel().fontSelect.value).toBe("Hiragino Sans");
  });

  it("現在のサイズを選択状態にする", () => {
    expect(renderPanel().sizeSelect.value).toBe("20");
  });

  it("フォントの選択肢を並べる", () => {
    const { fontSelect } = renderPanel();
    expect(fontSelect.options).toHaveLength(FONT_FAMILIES.length);
  });

  it("サイズの選択肢を並べる", () => {
    const { sizeSelect } = renderPanel();
    expect(sizeSelect.options).toHaveLength(FONT_SIZES.length);
  });

  it("フォントを変えると通知する", () => {
    const { fontSelect, onChangeFontFamily } = renderPanel();
    fireEvent.change(fontSelect, { target: { value: "Menlo" } });
    expect(onChangeFontFamily).toHaveBeenCalledWith("Menlo");
  });

  it("サイズを変えると数値で通知する", () => {
    const { sizeSelect, onChangeFontSize } = renderPanel();
    fireEvent.change(sizeSelect, { target: { value: "48" } });
    expect(onChangeFontSize).toHaveBeenCalledWith(48);
  });

  it("一覧にないフォントも選択肢に補う（保存ファイル由来の値）", () => {
    const { fontSelect } = renderPanel(
      createText({ id: "t", x: 0, y: 0, fontFamily: "Comic Sans MS" }),
    );
    expect(fontSelect.value).toBe("Comic Sans MS");
    expect(fontSelect.options).toHaveLength(FONT_FAMILIES.length + 1);
  });

  it("一覧にないサイズも選択肢に補う", () => {
    const { sizeSelect } = renderPanel(
      createText({ id: "t", x: 0, y: 0, fontSize: 37 }),
    );
    expect(sizeSelect.value).toBe("37");
    expect(sizeSelect.options).toHaveLength(FONT_SIZES.length + 1);
  });
});
