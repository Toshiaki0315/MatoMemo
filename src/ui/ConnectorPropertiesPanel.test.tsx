import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createConnector } from "../domain/board";
import { ConnectorPropertiesPanel } from "./ConnectorPropertiesPanel";

function renderPanel(
  connector = createConnector({ id: "c1", fromItemId: "a", toItemId: "b" }),
) {
  const onChange = vi.fn();
  const onDelete = vi.fn();
  render(
    <ConnectorPropertiesPanel
      connector={connector}
      onChange={onChange}
      onDelete={onDelete}
    />,
  );
  return {
    kindSelect: screen.getByLabelText("種類") as HTMLSelectElement,
    arrowCheckbox: screen.getByRole("checkbox", { name: "矢印" }),
    onChange,
    onDelete,
  };
}

describe("ConnectorPropertiesPanel", () => {
  it("現在の種類を選択状態にする", () => {
    expect(renderPanel().kindSelect.value).toBe("straight");
  });

  it("種類を変えると更新後の線を通知する", () => {
    const { kindSelect, onChange } = renderPanel();
    fireEvent.change(kindSelect, { target: { value: "curved" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "curved" }),
    );
  });

  it("矢印なしの状態を反映する", () => {
    expect(renderPanel().arrowCheckbox).not.toBeChecked();
  });

  it("矢印ありの状態を反映する", () => {
    const { arrowCheckbox } = renderPanel(
      createConnector({
        id: "c1",
        fromItemId: "a",
        toItemId: "b",
        arrow: true,
      }),
    );
    expect(arrowCheckbox).toBeChecked();
  });

  it("矢印を切り替えると通知する", () => {
    const { arrowCheckbox, onChange } = renderPanel();
    fireEvent.click(arrowCheckbox);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ arrow: true }),
    );
  });

  it("削除を押すと通知する", () => {
    const { onDelete } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "線を削除" }));
    expect(onDelete).toHaveBeenCalled();
  });
});
