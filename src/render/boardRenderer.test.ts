import { describe, expect, it } from "vitest";
import {
  createImage,
  createShape,
  createStickyNote,
} from "../domain/board";
import { createViewport } from "../domain/viewport";
import { createMockContext } from "../test/mockCanvas";
import { CANVAS_THEME, renderBoard } from "./boardRenderer";
import { computeGridLines } from "./grid";
import { SELECTION_COLOR } from "./palette";

const baseOptions = {
  width: 400,
  height: 300,
  devicePixelRatio: 1,
  viewport: createViewport(),
};

describe("renderBoard", () => {
  it("デバイスピクセル比に合わせて変換を設定する", () => {
    const mock = createMockContext();
    renderBoard(mock.ctx, { ...baseOptions, devicePixelRatio: 2 });
    expect(mock.callsOf("setTransform")[0]?.args).toEqual([2, 0, 0, 2, 0, 0]);
  });

  it("背景を塗りつぶす", () => {
    const mock = createMockContext();
    renderBoard(mock.ctx, baseOptions);
    expect(mock.callsOf("fillRect")[0]?.args).toEqual([0, 0, 400, 300]);
  });

  it("グリッド線を描く", () => {
    const mock = createMockContext();
    renderBoard(mock.ctx, baseOptions);

    const expected = computeGridLines(baseOptions.viewport, 400, 300);
    const moves = mock.callsOf("moveTo");
    expect(moves).toHaveLength(
      expected.vertical.length + expected.horizontal.length,
    );
    expect(mock.callsOf("stroke")).toHaveLength(1);
  });

  it("縦線は上端から下端まで引く", () => {
    const mock = createMockContext();
    renderBoard(mock.ctx, baseOptions);

    const firstX = computeGridLines(baseOptions.viewport, 400, 300).vertical[0];
    expect(mock.callsOf("moveTo")[0]?.args).toEqual([firstX, 0]);
    expect(mock.callsOf("lineTo")[0]?.args).toEqual([firstX, 300]);
  });

  it("横線は左端から右端まで引く", () => {
    const mock = createMockContext();
    renderBoard(mock.ctx, baseOptions);

    const grid = computeGridLines(baseOptions.viewport, 400, 300);
    const horizontalStart = grid.vertical.length;
    const firstY = grid.horizontal[0];
    expect(mock.callsOf("moveTo")[horizontalStart]?.args).toEqual([0, firstY]);
    expect(mock.callsOf("lineTo")[horizontalStart]?.args).toEqual([400, firstY]);
  });

  it("グリッドを非表示にできる", () => {
    const mock = createMockContext();
    renderBoard(mock.ctx, { ...baseOptions, showGrid: false });
    expect(mock.callsOf("moveTo")).toHaveLength(0);
    expect(mock.callsOf("stroke")).toHaveLength(0);
  });

  it("描画状態を save / restore で挟む", () => {
    const mock = createMockContext();
    renderBoard(mock.ctx, baseOptions);
    expect(mock.calls[0]?.method).toBe("save");
    expect(mock.calls.at(-1)?.method).toBe("restore");
  });

  it("暗いテーマの色を指定できる", () => {
    const mock = createMockContext();
    renderBoard(mock.ctx, { ...baseOptions, theme: CANVAS_THEME.dark });
    expect(mock.ctx.fillStyle).toBe(CANVAS_THEME.dark.background);
  });

  it("既定では明るいテーマを使う", () => {
    const mock = createMockContext();
    renderBoard(mock.ctx, { ...baseOptions, showGrid: false });
    expect(mock.ctx.fillStyle).toBe(CANVAS_THEME.light.background);
  });
});

describe("renderBoard: アイテム", () => {
  const sticky = createStickyNote({
    id: "s1",
    x: 10,
    y: 20,
    width: 100,
    height: 80,
  });

  it("アイテムが無ければ変換を追加しない", () => {
    const mock = createMockContext();
    renderBoard(mock.ctx, { ...baseOptions, items: [] });
    expect(mock.callsOf("setTransform")).toHaveLength(1);
  });

  it("アイテムを描く", () => {
    const mock = createMockContext();
    renderBoard(mock.ctx, { ...baseOptions, items: [sticky] });
    expect(mock.callsOf("roundRect")[0]?.args).toEqual([10, 20, 100, 80, 6]);
  });

  it("ビューポートとデバイスピクセル比を合成した変換を適用する", () => {
    const mock = createMockContext();
    renderBoard(mock.ctx, {
      ...baseOptions,
      devicePixelRatio: 2,
      viewport: { x: 30, y: 40, scale: 3 },
      items: [sticky],
    });
    expect(mock.callsOf("setTransform")[1]?.args).toEqual([6, 0, 0, 6, 60, 80]);
  });

  it("重なり順どおりに描く", () => {
    const mock = createMockContext();
    const back = createStickyNote({ id: "back", x: 0, y: 0 });
    const front = createShape({ id: "front", shape: "rectangle", x: 0, y: 0 });
    renderBoard(mock.ctx, { ...baseOptions, items: [back, front] });
    const order = mock.calls
      .filter((call) => call.method === "roundRect" || call.method === "rect")
      .map((call) => call.method);
    expect(order).toEqual(["roundRect", "rect"]);
  });

  it("選択中のアイテムに枠を描く", () => {
    const mock = createMockContext();
    renderBoard(mock.ctx, {
      ...baseOptions,
      items: [sticky],
      selectedIds: new Set(["s1"]),
    });
    expect(mock.ctx.strokeStyle).toBe(SELECTION_COLOR);
  });

  it("選択されていなければ枠を描かない", () => {
    const mock = createMockContext();
    renderBoard(mock.ctx, {
      ...baseOptions,
      items: [sticky],
      selectedIds: new Set(["other"]),
    });
    expect(mock.ctx.strokeStyle).not.toBe(SELECTION_COLOR);
  });

  it("画像キャッシュを描画に渡す", () => {
    const mock = createMockContext();
    const image = createImage({
      id: "img",
      x: 0,
      y: 0,
      source: "data:image/png;base64,AA",
      naturalWidth: 10,
      naturalHeight: 10,
    });
    const bitmap = {} as CanvasImageSource;
    renderBoard(mock.ctx, {
      ...baseOptions,
      items: [image],
      images: new Map([["img", bitmap]]),
    });
    expect(mock.callsOf("drawImage")).toHaveLength(1);
  });
});
