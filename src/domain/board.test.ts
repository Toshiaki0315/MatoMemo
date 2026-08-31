import { describe, expect, it } from "vitest";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_ITEM_FONT_SIZE,
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
      align: "center",
      verticalAlign: "middle",
      fontFamily: DEFAULT_FONT_FAMILY,
      fontSize: DEFAULT_ITEM_FONT_SIZE,
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
      align: "center",
      verticalAlign: "middle",
      fontFamily: DEFAULT_FONT_FAMILY,
      fontSize: DEFAULT_ITEM_FONT_SIZE,
      fill: "#FFFFFF",
      strokeWidth: 1,
      strokeStyle: "solid",
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
      align: "left",
      verticalAlign: "top",
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
        startCap: "none",
        endCap: "none",
        capSize: "medium",
        strokeWidth: 2,
        strokeStyle: "solid",
        bend: 0.5,
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

  it("両端の印を別々に指定できる", () => {
    expect(
      createConnector({
        id: "c1",
        fromItemId: "a",
        toItemId: "b",
        startCap: "arrow",
        endCap: "circle",
      }),
    ).toMatchObject({ startCap: "arrow", endCap: "circle" });
  });

  it("印の大きさを指定できる", () => {
    expect(
      createConnector({
        id: "c1",
        fromItemId: "a",
        toItemId: "b",
        capSize: "large",
      }).capSize,
    ).toBe("large");
  });

  it("線の太さと線種を指定できる", () => {
    expect(
      createConnector({
        id: "c1",
        fromItemId: "a",
        toItemId: "b",
        strokeWidth: 5,
        strokeStyle: "dashed",
      }),
    ).toMatchObject({ strokeWidth: 5, strokeStyle: "dashed" });
  });
});

describe("テキストの配置", () => {
  it("付箋と図形は中央寄せを既定にする", () => {
    expect(createStickyNote({ id: "s", x: 0, y: 0 })).toMatchObject({
      align: "center",
      verticalAlign: "middle",
    });
    expect(
      createShape({ id: "r", shape: "rectangle", x: 0, y: 0 }),
    ).toMatchObject({ align: "center", verticalAlign: "middle" });
  });

  it("単体テキストは左上寄せを既定にする", () => {
    expect(createText({ id: "t", x: 0, y: 0 })).toMatchObject({
      align: "left",
      verticalAlign: "top",
    });
  });

  it("配置を指定できる", () => {
    expect(
      createStickyNote({
        id: "s",
        x: 0,
        y: 0,
        align: "right",
        verticalAlign: "bottom",
      }),
    ).toMatchObject({ align: "right", verticalAlign: "bottom" });
  });

  it("片方だけ指定しても、もう片方は既定になる", () => {
    expect(
      createText({ id: "t", x: 0, y: 0, align: "center" }),
    ).toMatchObject({ align: "center", verticalAlign: "top" });
  });
});

describe("テキストの書体", () => {
  it("付箋と図形は枠に収まる小さめのサイズを既定にする", () => {
    expect(createStickyNote({ id: "s", x: 0, y: 0 })).toMatchObject({
      fontFamily: DEFAULT_FONT_FAMILY,
      fontSize: DEFAULT_ITEM_FONT_SIZE,
    });
    expect(
      createShape({ id: "r", shape: "rectangle", x: 0, y: 0 }),
    ).toMatchObject({ fontSize: DEFAULT_ITEM_FONT_SIZE });
  });

  it("単体テキストは大きめのサイズを既定にする", () => {
    expect(createText({ id: "t", x: 0, y: 0 })).toMatchObject({
      fontSize: DEFAULT_FONT_SIZE,
    });
  });

  it("付箋でもフォントを指定できる", () => {
    expect(
      createStickyNote({
        id: "s",
        x: 0,
        y: 0,
        fontFamily: "Menlo",
        fontSize: 32,
      }),
    ).toMatchObject({ fontFamily: "Menlo", fontSize: 32 });
  });

  it("図形でもフォントを指定できる", () => {
    expect(
      createShape({
        id: "r",
        shape: "circle",
        x: 0,
        y: 0,
        fontSize: 24,
      }),
    ).toMatchObject({ fontSize: 24 });
  });
});

describe("図形の塗りと枠線", () => {
  it("既定では白く塗り、細い実線で囲む", () => {
    expect(
      createShape({ id: "r", shape: "rectangle", x: 0, y: 0 }),
    ).toMatchObject({ fill: "#FFFFFF", strokeWidth: 1, strokeStyle: "solid" });
  });

  it("塗りの色を指定できる", () => {
    expect(
      createShape({ id: "r", shape: "rectangle", x: 0, y: 0, fill: "#FF0000" })
        .fill,
    ).toBe("#FF0000");
  });

  it("塗らないことも指定できる", () => {
    expect(
      createShape({ id: "r", shape: "rectangle", x: 0, y: 0, fill: null }).fill,
    ).toBeNull();
  });

  it("枠線の太さと種類を指定できる", () => {
    expect(
      createShape({
        id: "r",
        shape: "rectangle",
        x: 0,
        y: 0,
        strokeWidth: 5,
        strokeStyle: "dotted",
      }),
    ).toMatchObject({ strokeWidth: 5, strokeStyle: "dotted" });
  });
});
