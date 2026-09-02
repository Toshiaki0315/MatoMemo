import { describe, expect, it } from "vitest";
import {
  createImage,
  createShape,
  createStickyNote,
  createText,
  type Item,
} from "./board";
import { hitTest, itemBounds, itemsWithinRect } from "./hitTest";

const sticky = createStickyNote({
  id: "sticky",
  x: 0,
  y: 0,
  width: 100,
  height: 100,
});
const circle = createShape({
  id: "circle",
  shape: "circle",
  x: 200,
  y: 0,
  width: 100,
  height: 100,
});
const rectangle = createShape({
  id: "rect",
  shape: "rectangle",
  x: 400,
  y: 0,
  width: 100,
  height: 50,
});

describe("itemBounds", () => {
  it("アイテムの矩形を返す", () => {
    expect(itemBounds(rectangle)).toEqual({
      x: 400,
      y: 0,
      width: 100,
      height: 50,
    });
  });
});

describe("hitTest: 種類ごとの判定", () => {
  it("付箋は矩形として判定する", () => {
    expect(hitTest([sticky], { x: 50, y: 50 })?.id).toBe("sticky");
    expect(hitTest([sticky], { x: 101, y: 50 })).toBeUndefined();
  });

  it("矩形の図形は矩形として判定する", () => {
    expect(hitTest([rectangle], { x: 450, y: 25 })?.id).toBe("rect");
    expect(hitTest([rectangle], { x: 450, y: 60 })).toBeUndefined();
  });

  it("円は楕円として判定する（角は当たらない）", () => {
    // 中心は当たる
    expect(hitTest([circle], { x: 250, y: 50 })?.id).toBe("circle");
    // 外接矩形の左上角は円の外側なので当たらない
    expect(hitTest([circle], { x: 201, y: 1 })).toBeUndefined();
  });

  it("円の縁は当たる", () => {
    expect(hitTest([circle], { x: 200, y: 50 })?.id).toBe("circle");
    expect(hitTest([circle], { x: 250, y: 0 })?.id).toBe("circle");
  });

  it("テキストは矩形として判定する", () => {
    const text = createText({ id: "t", x: 0, y: 0, width: 80, height: 20 });
    expect(hitTest([text], { x: 40, y: 10 })?.id).toBe("t");
    expect(hitTest([text], { x: 40, y: 30 })).toBeUndefined();
  });

  it("画像は矩形として判定する", () => {
    const image = createImage({
      id: "img",
      x: 0,
      y: 0,
      width: 60,
      height: 40,
      source: "data:image/png;base64,AA",
      naturalWidth: 60,
      naturalHeight: 40,
    });
    expect(hitTest([image], { x: 30, y: 20 })?.id).toBe("img");
    expect(hitTest([image], { x: 30, y: 50 })).toBeUndefined();
  });
});

describe("hitTest: 重なり", () => {
  const lower = createStickyNote({
    id: "lower",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  const upper = createStickyNote({
    id: "upper",
    x: 50,
    y: 50,
    width: 100,
    height: 100,
  });

  it("重なっている場合は最前面のアイテムを返す", () => {
    expect(hitTest([lower, upper], { x: 75, y: 75 })?.id).toBe("upper");
  });

  it("最前面が外れていれば背面のアイテムを返す", () => {
    expect(hitTest([lower, upper], { x: 25, y: 25 })?.id).toBe("lower");
  });

  it("どれにも当たらなければ undefined を返す", () => {
    expect(hitTest([lower, upper], { x: 500, y: 500 })).toBeUndefined();
  });

  it("アイテムが無ければ undefined を返す", () => {
    expect(hitTest([], { x: 0, y: 0 })).toBeUndefined();
  });
});

describe("itemsWithinRect", () => {
  const items: Item[] = [sticky, circle, rectangle];

  it("矩形に完全に含まれるアイテムを返す", () => {
    expect(
      itemsWithinRect(items, { x: -10, y: -10, width: 130, height: 130 }).map(
        (item) => item.id,
      ),
    ).toEqual(["sticky"]);
  });

  it("一部しか重なっていないアイテムは含めない", () => {
    expect(
      itemsWithinRect(items, { x: -10, y: -10, width: 60, height: 60 }),
    ).toEqual([]);
  });

  it("複数を選択できる", () => {
    expect(
      itemsWithinRect(items, { x: -10, y: -10, width: 600, height: 200 }).map(
        (item) => item.id,
      ),
    ).toEqual(["sticky", "circle", "rect"]);
  });

  it("何も含まれなければ空を返す", () => {
    expect(
      itemsWithinRect(items, { x: 1000, y: 1000, width: 10, height: 10 }),
    ).toEqual([]);
  });
});

describe("hitTest: 直線", () => {
  /** (0,0)-(100,50) の対角線。 */
  const line = createShape({
    id: "line",
    shape: "line",
    x: 0,
    y: 0,
    width: 100,
    height: 50,
  });

  it("線分の近くなら当たる", () => {
    // 対角線の中点 (50, 25) のすぐそば
    expect(hitTest([line], { x: 50, y: 28 })).toBe(line);
  });

  it("外接矩形の中でも線分から離れていれば当たらない", () => {
    // 右上の角は矩形の中だが線からは遠い
    expect(hitTest([line], { x: 95, y: 5 })).toBeUndefined();
  });

  it("縮小表示では掴める距離をワールド座標で広げる", () => {
    const point = { x: 50, y: 40 };
    expect(hitTest([line], point, 1)).toBeUndefined();
    expect(hitTest([line], point, 0.5)).toBe(line);
  });

  it("向きが up なら反対の対角線で判定する", () => {
    const rising = createShape({
      id: "rising",
      shape: "line",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      lineDirection: "up",
    });
    // up の対角線 (左下→右上) は x:25 で y:37.5 を通る
    expect(hitTest([rising], { x: 25, y: 40 })).toBe(rising);
    // down の対角線が通る場所 (x:25, y:12.5) は、up では何もない
    expect(hitTest([rising], { x: 25, y: 12 })).toBeUndefined();
  });
});
