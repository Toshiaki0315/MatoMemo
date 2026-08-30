import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createShape } from "../domain/board";
import { FILL_COLORS } from "../render/palette";
import { ShapePropertiesPanel } from "./ShapePropertiesPanel";

function renderPanel(
  item = createShape({ id: "r", shape: "rectangle", x: 0, y: 0 }),
) {
  const onChange = vi.fn();
  render(<ShapePropertiesPanel item={item} onChange={onChange} />);
  return {
    fillSelect: screen.getByLabelText("塗り") as HTMLSelectElement,
    widthSelect: screen.getByLabelText("枠線の太さ") as HTMLSelectElement,
    styleSelect: screen.getByLabelText("枠線の種類") as HTMLSelectElement,
    onChange,
  };
}

describe("ShapePropertiesPanel: 塗り", () => {
  it("現在の塗り色を選択状態にする", () => {
    expect(renderPanel().fillSelect.value).toBe("#FFFFFF");
  });

  it("塗りなしを選択状態にできる", () => {
    const { fillSelect } = renderPanel(
      createShape({ id: "r", shape: "rectangle", x: 0, y: 0, fill: null }),
    );
    expect(fillSelect.value).toBe("");
  });

  it("色を選ぶと通知する", () => {
    const { fillSelect, onChange } = renderPanel();
    const color = FILL_COLORS[2]?.value as string;
    fireEvent.change(fillSelect, { target: { value: color } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ fill: color }),
    );
  });

  it("なしを選ぶと塗らないことを通知する", () => {
    const { fillSelect, onChange } = renderPanel();
    fireEvent.change(fillSelect, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ fill: null }));
  });

  it("なしを含めた選択肢を並べる", () => {
    expect(renderPanel().fillSelect.options).toHaveLength(
      FILL_COLORS.length + 1,
    );
  });
});

describe("ShapePropertiesPanel: 枠線", () => {
  it("現在の太さと種類を選択状態にする", () => {
    const { widthSelect, styleSelect } = renderPanel();
    expect(widthSelect.value).toBe("1");
    expect(styleSelect.value).toBe("solid");
  });

  it("太さを変えると数値で通知する", () => {
    const { widthSelect, onChange } = renderPanel();
    fireEvent.change(widthSelect, { target: { value: "5" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ strokeWidth: 5 }),
    );
  });

  it("種類を変えると通知する", () => {
    const { styleSelect, onChange } = renderPanel();
    fireEvent.change(styleSelect, { target: { value: "dotted" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ strokeStyle: "dotted" }),
    );
  });
});
