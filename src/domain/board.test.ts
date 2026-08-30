import { describe, expect, it } from "vitest";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_IMAGE_MAX_EDGE,
  DEFAULT_SHAPE_SIZE,
  DEFAULT_STICKY_SIZE,
  STICKY_COLORS,
  createBoard,
  createConnector,
  createImage,
  createShape,
  createStickyNote,
  createText,
} from "./board";

describe("STICKY_COLORS", () => {
  it("パステル 6 色を提供する", () => {
    expect(STICKY_COLORS).toHaveLength(6);
  });

  it("色名が重複しない", () => {
    expect(new Set(STICKY_COLORS).size).toBe(STICKY_COLORS.length);
  });
});

describe("createBoard", () => {
  it("空のボードを作る", () => {
    const board = createBoard({ id: "b1", name: "会議メモ" });
    expect(board).toEqual({
      id: "b1",
      name: "会議メモ",
      items: [],
      connectors: [],
    });
  });

  it("名前を省略すると既定名になる", () => {
    expect(createBoard({ id: "b1" }).name).toBe("無題のボード");
  });
});

describe("createStickyNote", () => {
  it("既定のサイズ・色・空テキストで作る", () => {
    expect(createStickyNote({ id: "i1", x: 10, y: 20 })).toEqual({
      id: "i1",
      type: "sticky",
      x: 10,
      y: 20,
      width: DEFAULT_STICKY_SIZE,
      height: DEFAULT_STICKY_SIZE,
      text: "",
      color: "yellow",
    });
  });

  it("色・テキスト・サイズを指定できる", () => {
    const note = createStickyNote({
      id: "i1",
      x: 0,
      y: 0,
      width: 300,
      height: 150,
      text: "やること",
      color: "blue",
    });
    expect(note).toMatchObject({
      width: 300,
      height: 150,
      text: "やること",
      color: "blue",
    });
  });
});

describe("createShape", () => {
  it("既定サイズの矩形を作る", () => {
    expect(createShape({ id: "i1", shape: "rectangle", x: 5, y: 6 })).toEqual({
      id: "i1",
      type: "shape",
      shape: "rectangle",
      x: 5,
      y: 6,
      width: DEFAULT_SHAPE_SIZE,
      height: DEFAULT_SHAPE_SIZE,
      text: "",
    });
  });

  it("円を作れる", () => {
    expect(createShape({ id: "i1", shape: "circle", x: 0, y: 0 }).shape).toBe(
      "circle",
    );
  });

  it("サイズとテキストを指定できる", () => {
    expect(
      createShape({
        id: "i1",
        shape: "circle",
        x: 0,
        y: 0,
        width: 80,
        height: 40,
        text: "原因",
      }),
    ).toMatchObject({ width: 80, height: 40, text: "原因" });
  });
});

describe("createText", () => {
  it("既定のフォントで作る", () => {
    expect(createText({ id: "i1", x: 1, y: 2 })).toEqual({
      id: "i1",
      type: "text",
      x: 1,
      y: 2,
      width: expect.any(Number),
      height: expect.any(Number),
      text: "",
      fontFamily: DEFAULT_FONT_FAMILY,
      fontSize: DEFAULT_FONT_SIZE,
    });
  });

  it("フォントとサイズを指定できる", () => {
    expect(
      createText({
        id: "i1",
        x: 0,
        y: 0,
        text: "見出し",
        fontFamily: "Hiragino Mincho ProN",
        fontSize: 48,
        width: 400,
        height: 60,
      }),
    ).toMatchObject({
      text: "見出し",
      fontFamily: "Hiragino Mincho ProN",
      fontSize: 48,
      width: 400,
      height: 60,
    });
  });
});

describe("createImage", () => {
  it("原寸が上限以下ならそのままのサイズで作る", () => {
    const image = createImage({
      id: "i1",
      x: 0,
      y: 0,
      source: "data:image/png;base64,AAAA",
      naturalWidth: 200,
      naturalHeight: 100,
    });
    expect(image).toEqual({
      id: "i1",
      type: "image",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      source: "data:image/png;base64,AAAA",
      naturalWidth: 200,
      naturalHeight: 100,
    });
  });

  it("横長の大きな画像は縦横比を保って上限に収める", () => {
    const image = createImage({
      id: "i1",
      x: 0,
      y: 0,
      source: "data:image/png;base64,AAAA",
      naturalWidth: 4000,
      naturalHeight: 2000,
    });
    expect(image.width).toBe(DEFAULT_IMAGE_MAX_EDGE);
    expect(image.height).toBe(DEFAULT_IMAGE_MAX_EDGE / 2);
  });

  it("縦長の大きな画像は縦横比を保って上限に収める", () => {
    const image = createImage({
      id: "i1",
      x: 0,
      y: 0,
      source: "data:image/png;base64,AAAA",
      naturalWidth: 1000,
      naturalHeight: 3000,
    });
    expect(image.height).toBe(DEFAULT_IMAGE_MAX_EDGE);
    expect(image.width).toBe(DEFAULT_IMAGE_MAX_EDGE / 3);
  });

  it("表示サイズを明示できる", () => {
    const image = createImage({
      id: "i1",
      x: 0,
      y: 0,
      source: "data:image/png;base64,AAAA",
      naturalWidth: 4000,
      naturalHeight: 2000,
      width: 100,
      height: 50,
    });
    expect(image).toMatchObject({ width: 100, height: 50 });
  });
});

describe("createConnector", () => {
  it("既定では直線コネクタを作る", () => {
    expect(createConnector({ id: "c1", fromItemId: "a", toItemId: "b" })).toEqual(
      {
        id: "c1",
        kind: "straight",
        fromItemId: "a",
        toItemId: "b",
      },
    );
  });

  it("種類を指定できる", () => {
    expect(
      createConnector({
        id: "c1",
        fromItemId: "a",
        toItemId: "b",
        kind: "curved",
      }).kind,
    ).toBe("curved");
  });
});
