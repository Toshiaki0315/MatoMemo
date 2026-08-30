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
    startCap: screen.getByLabelText("始点") as HTMLSelectElement,
    endCap: screen.getByLabelText("終点") as HTMLSelectElement,
    capSize: screen.getByLabelText("端の大きさ") as HTMLSelectElement,
    widthSelect: screen.getByLabelText("太さ") as HTMLSelectElement,
    styleSelect: screen.getByLabelText("線種") as HTMLSelectElement,
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

  it("端に何も付いていない状態を反映する", () => {
    const { startCap, endCap } = renderPanel();
    expect(startCap.value).toBe("none");
    expect(endCap.value).toBe("none");
  });

  it("両端の印を別々に反映する", () => {
    const { startCap, endCap } = renderPanel(
      createConnector({
        id: "c1",
        fromItemId: "a",
        toItemId: "b",
        startCap: "arrow",
        endCap: "circle",
      }),
    );
    expect(startCap.value).toBe("arrow");
    expect(endCap.value).toBe("circle");
  });

  it("始点の印を変えると通知する", () => {
    const { startCap, onChange } = renderPanel();
    fireEvent.change(startCap, { target: { value: "circle" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ startCap: "circle", endCap: "none" }),
    );
  });

  it("終点の印を変えると通知する", () => {
    const { endCap, onChange } = renderPanel();
    fireEvent.change(endCap, { target: { value: "arrow" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ endCap: "arrow" }),
    );
  });

  it("端の大きさを変えると通知する", () => {
    const { capSize, onChange } = renderPanel();
    expect(capSize.value).toBe("medium");
    fireEvent.change(capSize, { target: { value: "large" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ capSize: "large" }),
    );
  });

  it("線の太さを変えると通知する", () => {
    const { widthSelect, onChange } = renderPanel();
    fireEvent.change(widthSelect, { target: { value: "5" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ strokeWidth: 5 }),
    );
  });

  it("線種を変えると通知する", () => {
    const { styleSelect, onChange } = renderPanel();
    fireEvent.change(styleSelect, { target: { value: "dashed" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ strokeStyle: "dashed" }),
    );
  });

  it("削除を押すと通知する", () => {
    const { onDelete } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "線を削除" }));
    expect(onDelete).toHaveBeenCalled();
  });
});
