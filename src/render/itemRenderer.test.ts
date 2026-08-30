import { describe, expect, it } from "vitest";
import {
  createImage,
  createShape,
  createStickyNote,
  createText,
} from "../domain/board";
import { createMockContext } from "../test/mockCanvas";
import {
  drawItem,
  drawResizeHandles,
  drawSelectionOutline,
} from "./itemRenderer";
import { ITEM_TEXT_COLOR, SELECTION_COLOR, STICKY_PALETTE } from "./palette";

describe("drawItem: 付箋", () => {
  const sticky = createStickyNote({
    id: "s",
    x: 10,
    y: 20,
    width: 100,
    height: 80,
    color: "blue",
  });

  it("角丸の矩形をパレットの色で塗る", () => {
    const mock = createMockContext();
    drawItem(mock.ctx, sticky);
    expect(mock.callsOf("roundRect")[0]?.args).toEqual([10, 20, 100, 80, 6]);
    expect(mock.callsOf("fill")).toHaveLength(1);
    expect(mock.ctx.fillStyle).toBe(STICKY_PALETTE.blue.fill);
    expect(mock.ctx.strokeStyle).toBe(STICKY_PALETTE.blue.border);
  });

  it("テキストはパレットに対して読める色で描く", () => {
    const mock = createMockContext();
    drawItem(mock.ctx, { ...sticky, text: "メモ" });
    // テキスト描画が最後なので、最終的な fillStyle が文字色になる
    expect(mock.ctx.fillStyle).toBe(ITEM_TEXT_COLOR);
  });

  it("枠線を描く", () => {
    const mock = createMockContext();
    drawItem(mock.ctx, sticky);
    expect(mock.callsOf("stroke")).toHaveLength(1);
  });

  it("テキストがなければ文字を描かない", () => {
    const mock = createMockContext();
    drawItem(mock.ctx, sticky);
    expect(mock.callsOf("fillText")).toHaveLength(0);
  });

  it("テキストがあれば描く", () => {
    const mock = createMockContext();
    drawItem(mock.ctx, { ...sticky, text: "メモ" });
    expect(mock.callsOf("fillText")).toHaveLength(1);
    expect(mock.callsOf("fillText")[0]?.args[0]).toBe("メモ");
  });

  it("すべての色を描ける", () => {
    for (const color of Object.keys(STICKY_PALETTE) as (keyof typeof STICKY_PALETTE)[]) {
      const mock = createMockContext();
      expect(() => drawItem(mock.ctx, { ...sticky, color })).not.toThrow();
    }
  });
});

describe("drawItem: 図形", () => {
  it("矩形を描く", () => {
    const mock = createMockContext();
    drawItem(
      mock.ctx,
      createShape({ id: "r", shape: "rectangle", x: 0, y: 0, width: 50, height: 30 }),
    );
    expect(mock.callsOf("rect")[0]?.args).toEqual([0, 0, 50, 30]);
    expect(mock.callsOf("ellipse")).toHaveLength(0);
  });

  it("円を楕円として描く", () => {
    const mock = createMockContext();
    drawItem(
      mock.ctx,
      createShape({ id: "c", shape: "circle", x: 0, y: 0, width: 100, height: 50 }),
    );
    expect(mock.callsOf("ellipse")[0]?.args).toEqual([50, 25, 50, 25, 0, 0, Math.PI * 2]);
    expect(mock.callsOf("rect")).toHaveLength(0);
  });

  it("図形内のテキストを描く", () => {
    const mock = createMockContext();
    drawItem(
      mock.ctx,
      createShape({ id: "r", shape: "rectangle", x: 0, y: 0, text: "原因" }),
    );
    expect(mock.callsOf("fillText")[0]?.args[0]).toBe("原因");
  });
});

describe("drawItem: テキスト", () => {
  it("フォントとサイズを反映する", () => {
    const mock = createMockContext();
    drawItem(
      mock.ctx,
      createText({
        id: "t",
        x: 0,
        y: 0,
        text: "見出し",
        fontFamily: "Hiragino Mincho ProN",
        fontSize: 32,
      }),
    );
    expect(mock.ctx.font).toContain("32px");
    expect(mock.ctx.font).toContain("Hiragino Mincho ProN");
  });

  it("背景や枠線は描かない", () => {
    const mock = createMockContext();
    drawItem(mock.ctx, createText({ id: "t", x: 0, y: 0, text: "文字" }));
    expect(mock.callsOf("fill")).toHaveLength(0);
    expect(mock.callsOf("stroke")).toHaveLength(0);
  });

  it("左寄せで描く", () => {
    const mock = createMockContext();
    drawItem(mock.ctx, createText({ id: "t", x: 5, y: 5, text: "文字" }));
    expect(mock.ctx.textAlign).toBe("left");
  });

  it("空のテキストは何も描かない", () => {
    const mock = createMockContext();
    drawItem(mock.ctx, createText({ id: "t", x: 0, y: 0 }));
    expect(mock.calls).toEqual([]);
  });

  it("複数行に折り返して描く", () => {
    const mock = createMockContext();
    drawItem(mock.ctx, createText({ id: "t", x: 0, y: 0, text: "一行目\n二行目" }));
    expect(mock.callsOf("fillText").map((call) => call.args[0])).toEqual([
      "一行目",
      "二行目",
    ]);
  });
});

describe("drawItem: 画像", () => {
  const image = createImage({
    id: "i",
    x: 10,
    y: 10,
    width: 80,
    height: 60,
    source: "data:image/png;base64,AA",
    naturalWidth: 80,
    naturalHeight: 60,
  });

  it("読み込み済みの画像を描く", () => {
    const mock = createMockContext();
    const bitmap = {} as CanvasImageSource;
    drawItem(mock.ctx, image, { images: new Map([[image.id, bitmap]]) });
    expect(mock.callsOf("drawImage")[0]?.args).toEqual([bitmap, 10, 10, 80, 60]);
  });

  it("未読み込みならプレースホルダを描く", () => {
    const mock = createMockContext();
    drawItem(mock.ctx, image);
    expect(mock.callsOf("drawImage")).toHaveLength(0);
    expect(mock.callsOf("rect")[0]?.args).toEqual([10, 10, 80, 60]);
  });
});

describe("drawSelectionOutline", () => {
  it("選択枠を描く", () => {
    const mock = createMockContext();
    drawSelectionOutline(
      mock.ctx,
      createStickyNote({ id: "s", x: 10, y: 20, width: 100, height: 80 }),
      1,
    );
    expect(mock.ctx.strokeStyle).toBe(SELECTION_COLOR);
    expect(mock.callsOf("stroke")).toHaveLength(1);
  });

  it("拡大率に反比例した線幅にして見た目の太さを保つ", () => {
    const mock = createMockContext();
    const item = createStickyNote({ id: "s", x: 0, y: 0 });
    drawSelectionOutline(mock.ctx, item, 4);
    const atScale4 = mock.ctx.lineWidth;
    drawSelectionOutline(mock.ctx, item, 1);
    expect(atScale4).toBeLessThan(mock.ctx.lineWidth);
  });

  it("円の選択枠は楕円で描く", () => {
    const mock = createMockContext();
    drawSelectionOutline(
      mock.ctx,
      createShape({ id: "c", shape: "circle", x: 0, y: 0, width: 100, height: 100 }),
      1,
    );
    expect(mock.callsOf("ellipse")).toHaveLength(1);
  });
});

describe("drawItem: 編集中のテキストを隠す", () => {
  it("付箋のテキストを描かない", () => {
    const mock = createMockContext();
    drawItem(
      mock.ctx,
      createStickyNote({ id: "s", x: 0, y: 0, text: "メモ" }),
      { hideText: true },
    );
    expect(mock.callsOf("fillText")).toHaveLength(0);
    // 付箋そのものは描く
    expect(mock.callsOf("roundRect")).toHaveLength(1);
  });

  it("図形のテキストを描かない", () => {
    const mock = createMockContext();
    drawItem(
      mock.ctx,
      createShape({ id: "r", shape: "rectangle", x: 0, y: 0, text: "原因" }),
      { hideText: true },
    );
    expect(mock.callsOf("fillText")).toHaveLength(0);
    expect(mock.callsOf("rect")).toHaveLength(1);
  });

  it("単体テキストは何も描かない", () => {
    const mock = createMockContext();
    drawItem(mock.ctx, createText({ id: "t", x: 0, y: 0, text: "見出し" }), {
      hideText: true,
    });
    expect(mock.calls).toEqual([]);
  });
});

describe("drawResizeHandles", () => {
  const item = createStickyNote({
    id: "s",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });

  it("8 個のハンドルを描く", () => {
    const mock = createMockContext();
    drawResizeHandles(mock.ctx, item, 1);
    expect(mock.callsOf("rect")).toHaveLength(8);
    expect(mock.callsOf("fill")).toHaveLength(8);
    expect(mock.callsOf("stroke")).toHaveLength(8);
  });

  it("ハンドルはアイテムの角と辺の中点に置く", () => {
    const mock = createMockContext();
    drawResizeHandles(mock.ctx, item, 1);
    const rects = mock.callsOf("rect").map((call) => call.args.slice(0, 2));
    // 左上のハンドル（一辺 8px なので中心から 4 ずれる）
    expect(rects).toContainEqual([-4, -4]);
    // 右下のハンドル
    expect(rects).toContainEqual([96, 96]);
  });

  it("拡大率に反比例して小さくし、見た目の大きさを保つ", () => {
    const mock = createMockContext();
    drawResizeHandles(mock.ctx, item, 4);
    const size = mock.callsOf("rect")[0]?.args[2];
    expect(size).toBe(2);
  });
});
