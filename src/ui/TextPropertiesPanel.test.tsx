import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createShape, createStickyNote, createText } from "../domain/board";
import {
  FONT_FAMILIES,
  FONT_SIZES,
  TextPropertiesPanel,
} from "./TextPropertiesPanel";

function renderPanel(
  item: Parameters<typeof TextPropertiesPanel>[0]["item"] = createText({
    id: "t",
    x: 0,
    y: 0,
  }),
) {
  const onChange = vi.fn();
  render(<TextPropertiesPanel item={item} onChange={onChange} />);
  return {
    fontSelect: screen.queryByLabelText("フォント") as HTMLSelectElement,
    sizeSelect: screen.queryByLabelText("サイズ") as HTMLSelectElement,
    alignSelect: screen.getByLabelText("横位置") as HTMLSelectElement,
    verticalSelect: screen.getByLabelText("縦位置") as HTMLSelectElement,
    onChange,
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

  it("フォントを変えると更新後のアイテムを通知する", () => {
    const { fontSelect, onChange } = renderPanel();
    fireEvent.change(fontSelect, { target: { value: "Menlo" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ fontFamily: "Menlo" }),
    );
  });

  it("サイズを変えると数値で通知する", () => {
    const { sizeSelect, onChange } = renderPanel();
    fireEvent.change(sizeSelect, { target: { value: "48" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ fontSize: 48 }),
    );
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

describe("TextPropertiesPanel: テキストの配置", () => {
  it("現在の横位置を選択状態にする", () => {
    expect(renderPanel().alignSelect.value).toBe("left");
  });

  it("現在の縦位置を選択状態にする", () => {
    expect(renderPanel().verticalSelect.value).toBe("top");
  });

  it("横位置を変えると通知する", () => {
    const { alignSelect, onChange } = renderPanel();
    fireEvent.change(alignSelect, { target: { value: "right" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ align: "right" }),
    );
  });

  it("縦位置を変えると通知する", () => {
    const { verticalSelect, onChange } = renderPanel();
    fireEvent.change(verticalSelect, { target: { value: "bottom" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ verticalAlign: "bottom" }),
    );
  });

  it("付箋にも配置の設定を出す", () => {
    const { alignSelect, verticalSelect } = renderPanel(
      createStickyNote({ id: "s", x: 0, y: 0 }),
    );
    expect(alignSelect.value).toBe("center");
    expect(verticalSelect.value).toBe("middle");
  });

  it("付箋にもフォントの設定を出す", () => {
    const { fontSelect, sizeSelect } = renderPanel(
      createStickyNote({ id: "s", x: 0, y: 0 }),
    );
    expect(fontSelect).toBeInTheDocument();
    expect(sizeSelect.value).toBe("16");
  });

  it("付箋のフォントを変えると更新後のアイテムを通知する", () => {
    const { sizeSelect, onChange } = renderPanel(
      createStickyNote({ id: "s", x: 0, y: 0 }),
    );
    fireEvent.change(sizeSelect, { target: { value: "24" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: "sticky", fontSize: 24 }),
    );
  });

  it("図形にも配置の設定を出す", () => {
    const { alignSelect } = renderPanel(
      createShape({ id: "r", shape: "rectangle", x: 0, y: 0 }),
    );
    expect(alignSelect).toBeInTheDocument();
  });
});
