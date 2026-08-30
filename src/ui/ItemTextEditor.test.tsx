import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createShape, createStickyNote, createText } from "../domain/board";
import { createViewport } from "../domain/viewport";
import { ItemTextEditor, type TextEditableItem } from "./ItemTextEditor";

function renderEditor(
  item: TextEditableItem,
  viewport = createViewport(),
) {
  const onChangeText = vi.fn();
  const onClose = vi.fn();
  render(
    <ItemTextEditor
      item={item}
      viewport={viewport}
      onChangeText={onChangeText}
      onClose={onClose}
    />,
  );
  const textarea = screen.getByLabelText(
    "アイテムのテキスト",
  ) as HTMLTextAreaElement;
  return { textarea, onChangeText, onClose };
}

const sticky = createStickyNote({
  id: "s",
  x: 100,
  y: 50,
  width: 200,
  height: 160,
  text: "メモ",
});

describe("ItemTextEditor", () => {
  it("アイテムのテキストを初期値にする", () => {
    expect(renderEditor(sticky).textarea.value).toBe("メモ");
  });

  it("開いた直後にフォーカスされる", () => {
    const { textarea } = renderEditor(sticky);
    expect(document.activeElement).toBe(textarea);
  });

  it("入力すると onChangeText を呼ぶ", () => {
    const { textarea, onChangeText } = renderEditor(sticky);
    fireEvent.change(textarea, { target: { value: "書き換え" } });
    expect(onChangeText).toHaveBeenCalledWith("書き換え");
  });

  it("Escape で閉じる", () => {
    const { textarea, onClose } = renderEditor(sticky);
    fireEvent.keyDown(textarea, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("他のキーでは閉じない", () => {
    const { textarea, onClose } = renderEditor(sticky);
    fireEvent.keyDown(textarea, { key: "a" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("フォーカスを失うと閉じる", () => {
    const { textarea, onClose } = renderEditor(sticky);
    fireEvent.blur(textarea);
    expect(onClose).toHaveBeenCalled();
  });
});

describe("ItemTextEditor: 配置", () => {
  /** 編集欄を包む要素。 */
  function container(): HTMLElement {
    return screen.getByLabelText("アイテムのテキスト").parentElement as HTMLElement;
  }

  it("アイテムと同じ画面位置・大きさに重ねる", () => {
    renderEditor(sticky);
    expect(container().style.left).toBe("100px");
    expect(container().style.top).toBe("50px");
    expect(container().style.width).toBe("200px");
    expect(container().style.height).toBe("160px");
  });

  it("ビューポートの拡大・平行移動を反映する", () => {
    renderEditor(sticky, { x: 10, y: 20, scale: 2 });
    expect(container().style.left).toBe("210px");
    expect(container().style.top).toBe("120px");
    expect(container().style.width).toBe("400px");
  });

  it("付箋は中央寄せにする", () => {
    renderEditor(sticky);
    expect(container().style.alignItems).toBe("center");
    expect(
      (screen.getByLabelText("アイテムのテキスト") as HTMLTextAreaElement).style
        .textAlign,
    ).toBe("center");
  });

  it("図形も中央寄せにする", () => {
    renderEditor(
      createShape({ id: "r", shape: "rectangle", x: 0, y: 0, text: "原因" }),
    );
    expect(container().style.alignItems).toBe("center");
  });

  it("単体テキストは上寄せ・左寄せにする", () => {
    renderEditor(createText({ id: "t", x: 0, y: 0, text: "見出し" }));
    expect(container().style.alignItems).toBe("flex-start");
    expect(
      (screen.getByLabelText("アイテムのテキスト") as HTMLTextAreaElement).style
        .textAlign,
    ).toBe("left");
  });

  it("単体テキストはアイテムのフォント設定を使う", () => {
    const { textarea } = renderEditor(
      createText({
        id: "t",
        x: 0,
        y: 0,
        text: "見出し",
        fontFamily: "Hiragino Mincho ProN",
        fontSize: 32,
      }),
    );
    expect(textarea.style.fontSize).toBe("32px");
    expect(textarea.style.fontFamily).toContain("Hiragino Mincho ProN");
  });

  it("拡大するとフォントサイズも拡大する", () => {
    const { textarea } = renderEditor(
      createText({ id: "t", x: 0, y: 0, fontSize: 20 }),
      { x: 0, y: 0, scale: 2 },
    );
    expect(textarea.style.fontSize).toBe("40px");
  });
});
