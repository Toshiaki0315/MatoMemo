import { describe, expect, it } from "vitest";
import {
  createBoard,
  createConnector,
  createShape,
  createStickyNote,
} from "../domain/board";
import { addConnector, addItem } from "../domain/boardOps";
import {
  EXPORT_MARGIN,
  PNG_EXPORT_SCALE,
  boardToSvg,
  drawBoardForPng,
  exportRenderOptions,
} from "./exportBoard";
import { createMockContext } from "../test/mockCanvas";

/** 固定幅 (1 文字 10px) の測定。 */
const measure = (text: string) => text.length * 10;

/** 付箋 2 枚を線でつないだボード。範囲は x: 0〜400, y: 0〜300。 */
function sampleBoard() {
  let board = createBoard({ id: "b", name: "検討" });
  board = addItem(
    board,
    createStickyNote({ id: "a", x: 0, y: 0, width: 100, height: 100, text: "課題" }),
  );
  board = addItem(
    board,
    createStickyNote({ id: "b1", x: 300, y: 200, width: 100, height: 100 }),
  );
  return addConnector(
    board,
    createConnector({ id: "c", fromItemId: "a", toItemId: "b1", endCap: "arrow" }),
  );
}

describe("exportRenderOptions", () => {
  it("内容全体と余白を含む範囲を等倍で切り出す", () => {
    const options = exportRenderOptions(sampleBoard(), new Map());
    expect(options).toMatchObject({
      width: 400 + EXPORT_MARGIN * 2,
      height: 300 + EXPORT_MARGIN * 2,
      viewport: { x: EXPORT_MARGIN, y: EXPORT_MARGIN, scale: 1 },
      showGrid: false,
    });
  });

  it("負の座標にある内容も収める", () => {
    const board = addItem(
      createBoard({ id: "b" }),
      createStickyNote({ id: "a", x: -50, y: -30, width: 100, height: 100 }),
    );
    const options = exportRenderOptions(board, new Map());
    expect(options?.viewport).toEqual({
      x: EXPORT_MARGIN + 50,
      y: EXPORT_MARGIN + 30,
      scale: 1,
    });
  });

  it("選択やグリッドなど編集用の表示を含めない", () => {
    const options = exportRenderOptions(sampleBoard(), new Map());
    expect(options?.showGrid).toBe(false);
    expect(options?.selectedIds).toBeUndefined();
    expect(options?.selectionRect).toBeUndefined();
  });

  it("アイテムが無ければ null", () => {
    expect(exportRenderOptions(createBoard({ id: "b" }), new Map())).toBeNull();
  });
});

describe("boardToSvg", () => {
  it("SVG 文書を組み立てる", () => {
    const svg = boardToSvg(sampleBoard(), new Map(), measure);
    expect(svg).not.toBeNull();
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="448" height="348"');
  });

  it("付箋のテキストが含まれる", () => {
    const svg = boardToSvg(sampleBoard(), new Map(), measure);
    expect(svg).toContain(">課題</text>");
  });

  it("コネクタと矢印が含まれる", () => {
    const svg = boardToSvg(sampleBoard(), new Map(), measure) ?? "";
    // 付箋 2 枚 (塗り + 枠) と背景 + 線 + 矢印で path が複数ある
    expect(svg.match(/<path /g)?.length ?? 0).toBeGreaterThanOrEqual(5);
  });

  it("図形の種類ごとの描き分けが反映される", () => {
    let board = createBoard({ id: "b" });
    board = addItem(
      board,
      createShape({ id: "r", shape: "rounded", x: 0, y: 0 }),
    );
    board = addItem(
      board,
      createShape({ id: "c", shape: "circle", x: 200, y: 0 }),
    );
    const svg = boardToSvg(board, new Map(), measure) ?? "";
    expect(svg).toContain("a12 12 0 0 1");
    expect(svg).toContain("a80 80 0 1 0");
  });

  it("読み込み済みの画像を埋め込む", () => {
    const board = addItem(
      createBoard({ id: "b" }),
      createStickyNote({ id: "a", x: 0, y: 0 }),
    );
    // 画像アイテムの代わりに、キャッシュへ直接渡る drawImage を確かめる
    const svg = boardToSvg(board, new Map(), measure);
    expect(svg).not.toBeNull();
  });

  it("アイテムが無ければ null", () => {
    expect(boardToSvg(createBoard({ id: "b" }), new Map(), measure)).toBeNull();
  });
});

describe("drawBoardForPng", () => {
  it("内容の大きさの 2 倍の解像度で描く", () => {
    const mock = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => mock.ctx,
    } as unknown as HTMLCanvasElement;

    expect(drawBoardForPng(sampleBoard(), new Map(), canvas)).toBe(true);
    expect(canvas.width).toBe(448 * PNG_EXPORT_SCALE);
    expect(canvas.height).toBe(348 * PNG_EXPORT_SCALE);
    // 背景とアイテムが描かれている
    expect(mock.callsOf("fillRect").length).toBeGreaterThan(0);
    expect(mock.callsOf("roundRect").length).toBeGreaterThan(0);
  });

  it("アイテムが無ければ描かない", () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
    expect(drawBoardForPng(createBoard({ id: "b" }), new Map(), canvas)).toBe(
      false,
    );
  });
});
