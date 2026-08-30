import { describe, expect, it } from "vitest";
import type { Rect } from "./geometry";
import {
  MIN_ITEM_SIZE,
  RESIZE_HANDLES,
  cursorForHandle,
  handlePosition,
  hitTestHandle,
  resizeRect,
} from "./resize";

const bounds: Rect = { x: 100, y: 50, width: 200, height: 100 };

describe("RESIZE_HANDLES", () => {
  it("8 方向のハンドルを持つ", () => {
    expect(RESIZE_HANDLES).toHaveLength(8);
    expect(new Set(RESIZE_HANDLES).size).toBe(8);
  });
});

describe("handlePosition", () => {
  it("四隅を返す", () => {
    expect(handlePosition(bounds, "nw")).toEqual({ x: 100, y: 50 });
    expect(handlePosition(bounds, "ne")).toEqual({ x: 300, y: 50 });
    expect(handlePosition(bounds, "sw")).toEqual({ x: 100, y: 150 });
    expect(handlePosition(bounds, "se")).toEqual({ x: 300, y: 150 });
  });

  it("辺の中点を返す", () => {
    expect(handlePosition(bounds, "n")).toEqual({ x: 200, y: 50 });
    expect(handlePosition(bounds, "s")).toEqual({ x: 200, y: 150 });
    expect(handlePosition(bounds, "w")).toEqual({ x: 100, y: 100 });
    expect(handlePosition(bounds, "e")).toEqual({ x: 300, y: 100 });
  });
});

describe("cursorForHandle", () => {
  it("方向に応じたカーソルを返す", () => {
    expect(cursorForHandle("nw")).toBe("nwse-resize");
    expect(cursorForHandle("se")).toBe("nwse-resize");
    expect(cursorForHandle("ne")).toBe("nesw-resize");
    expect(cursorForHandle("sw")).toBe("nesw-resize");
    expect(cursorForHandle("n")).toBe("ns-resize");
    expect(cursorForHandle("s")).toBe("ns-resize");
    expect(cursorForHandle("e")).toBe("ew-resize");
    expect(cursorForHandle("w")).toBe("ew-resize");
  });
});

describe("hitTestHandle", () => {
  it("ハンドルの中心を当てる", () => {
    expect(hitTestHandle(bounds, { x: 300, y: 150 }, 1)).toBe("se");
  });

  it("ハンドルの近くも当たる", () => {
    expect(hitTestHandle(bounds, { x: 303, y: 152 }, 1)).toBe("se");
  });

  it("離れた点は当たらない", () => {
    expect(hitTestHandle(bounds, { x: 200, y: 100 }, 1)).toBeUndefined();
  });

  it("拡大時は当たり判定の範囲がワールド座標では狭くなる", () => {
    // 等倍では当たる距離でも、4 倍では画面上の距離が 4 倍になるため外れる
    expect(hitTestHandle(bounds, { x: 305, y: 150 }, 1)).toBe("se");
    expect(hitTestHandle(bounds, { x: 305, y: 150 }, 4)).toBeUndefined();
  });

  it("すべてのハンドルを当てられる", () => {
    for (const handle of RESIZE_HANDLES) {
      expect(hitTestHandle(bounds, handlePosition(bounds, handle), 1)).toBe(
        handle,
      );
    }
  });
});

describe("resizeRect: 基本", () => {
  it("南東を引くと右下だけが動く", () => {
    expect(resizeRect(bounds, "se", 50, 20)).toEqual({
      x: 100,
      y: 50,
      width: 250,
      height: 120,
    });
  });

  it("北西を引くと左上だけが動く", () => {
    expect(resizeRect(bounds, "nw", 50, 20)).toEqual({
      x: 150,
      y: 70,
      width: 150,
      height: 80,
    });
  });

  it("東は幅だけを変える", () => {
    expect(resizeRect(bounds, "e", 40, 999)).toEqual({
      x: 100,
      y: 50,
      width: 240,
      height: 100,
    });
  });

  it("西は左端と幅を変える", () => {
    expect(resizeRect(bounds, "w", 40, 0)).toEqual({
      x: 140,
      y: 50,
      width: 160,
      height: 100,
    });
  });

  it("南は高さだけを変える", () => {
    expect(resizeRect(bounds, "s", 999, 30)).toEqual({
      x: 100,
      y: 50,
      width: 200,
      height: 130,
    });
  });

  it("北は上端と高さを変える", () => {
    expect(resizeRect(bounds, "n", 0, 30)).toEqual({
      x: 100,
      y: 80,
      width: 200,
      height: 70,
    });
  });

  it("北東は上端と右端を動かす", () => {
    expect(resizeRect(bounds, "ne", 10, 10)).toEqual({
      x: 100,
      y: 60,
      width: 210,
      height: 90,
    });
  });

  it("南西は左端と下端を動かす", () => {
    expect(resizeRect(bounds, "sw", 10, 10)).toEqual({
      x: 110,
      y: 50,
      width: 190,
      height: 110,
    });
  });
});

describe("resizeRect: 最小サイズ", () => {
  it("幅は最小サイズを下回らない", () => {
    expect(resizeRect(bounds, "e", -1000, 0).width).toBe(MIN_ITEM_SIZE);
  });

  it("高さは最小サイズを下回らない", () => {
    expect(resizeRect(bounds, "s", 0, -1000).height).toBe(MIN_ITEM_SIZE);
  });

  it("西から縮めても反対側の辺は動かない", () => {
    const result = resizeRect(bounds, "w", 1000, 0);
    expect(result.width).toBe(MIN_ITEM_SIZE);
    // 右端 (300) が保たれる
    expect(result.x + result.width).toBe(300);
  });

  it("北から縮めても下端は動かない", () => {
    const result = resizeRect(bounds, "n", 0, 1000);
    expect(result.height).toBe(MIN_ITEM_SIZE);
    expect(result.y + result.height).toBe(150);
  });
});

describe("resizeRect: 縦横比の維持", () => {
  const square: Rect = { x: 0, y: 0, width: 100, height: 100 };

  it("角のドラッグで比を保つ", () => {
    // 比 2:1 を保ったまま幅を 200 にすると高さは 100
    const result = resizeRect(
      { x: 0, y: 0, width: 100, height: 50 },
      "se",
      100,
      0,
      { aspectRatio: 2 },
    );
    expect(result.width / result.height).toBeCloseTo(2, 10);
  });

  it("角では変化の大きいほうの辺に合わせる", () => {
    const result = resizeRect(square, "se", 10, 100, { aspectRatio: 1 });
    // 高さの変化 (100) のほうが大きいので高さが主になる
    expect(result.height).toBe(200);
    expect(result.width).toBe(200);
  });

  it("東西のドラッグでも比を保つ", () => {
    const result = resizeRect(square, "e", 100, 0, { aspectRatio: 2 });
    expect(result.width).toBe(200);
    expect(result.height).toBe(100);
  });

  it("南北のドラッグでも比を保つ", () => {
    const result = resizeRect(square, "s", 0, 100, { aspectRatio: 2 });
    expect(result.height).toBe(200);
    expect(result.width).toBe(400);
  });

  it("北西では右下が固定される", () => {
    const result = resizeRect(square, "nw", 50, 50, { aspectRatio: 1 });
    expect(result.x + result.width).toBe(100);
    expect(result.y + result.height).toBe(100);
  });

  it("最小サイズに達しても比を保つ", () => {
    const result = resizeRect(
      { x: 0, y: 0, width: 100, height: 50 },
      "se",
      -1000,
      -1000,
      { aspectRatio: 2 },
    );
    expect(result.width / result.height).toBeCloseTo(2, 10);
    expect(Math.min(result.width, result.height)).toBeGreaterThanOrEqual(
      MIN_ITEM_SIZE,
    );
  });

  it("縦長でも最小サイズと比を両立する", () => {
    const result = resizeRect(
      { x: 0, y: 0, width: 50, height: 100 },
      "se",
      -1000,
      -1000,
      { aspectRatio: 0.5 },
    );
    expect(result.width / result.height).toBeCloseTo(0.5, 10);
    expect(Math.min(result.width, result.height)).toBeGreaterThanOrEqual(
      MIN_ITEM_SIZE,
    );
  });

  it("比が 0 以下なら制約しない", () => {
    expect(resizeRect(square, "se", 100, 0, { aspectRatio: 0 })).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });
  });
});
