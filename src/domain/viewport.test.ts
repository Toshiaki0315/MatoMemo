import { describe, expect, it } from "vitest";
import {
  MAX_SCALE,
  MIN_SCALE,
  clampScale,
  createViewport,
  fitScaleToContent,
  panBy,
  toScreen,
  toWorld,
  visibleWorldRect,
  zoomAt,
  type Viewport,
} from "./viewport";

describe("createViewport", () => {
  it("原点・等倍のビューポートを作る", () => {
    expect(createViewport()).toEqual({ x: 0, y: 0, scale: 1 });
  });
});

describe("clampScale", () => {
  it("範囲内の倍率はそのまま返す", () => {
    expect(clampScale(2)).toBe(2);
  });

  it("下限より小さい倍率は下限に丸める", () => {
    expect(clampScale(MIN_SCALE / 10)).toBe(MIN_SCALE);
  });

  it("上限より大きい倍率は上限に丸める", () => {
    expect(clampScale(MAX_SCALE * 10)).toBe(MAX_SCALE);
  });
});

describe("toScreen / toWorld", () => {
  const viewport: Viewport = { x: 100, y: 50, scale: 2 };

  it("ワールド座標を画面座標へ変換する", () => {
    expect(toScreen(viewport, { x: 10, y: 20 })).toEqual({ x: 120, y: 90 });
  });

  it("画面座標をワールド座標へ変換する", () => {
    expect(toWorld(viewport, { x: 120, y: 90 })).toEqual({ x: 10, y: 20 });
  });

  it("往復すると元の座標に戻る", () => {
    const world = { x: -37.5, y: 12.25 };
    expect(toWorld(viewport, toScreen(viewport, world))).toEqual(world);
  });

  it("等倍・原点では座標が一致する", () => {
    const identity = createViewport();
    expect(toScreen(identity, { x: 7, y: 9 })).toEqual({ x: 7, y: 9 });
  });
});

describe("panBy", () => {
  it("画面座標の移動量だけ平行移動する", () => {
    expect(panBy({ x: 10, y: 20, scale: 2 }, 5, -5)).toEqual({
      x: 15,
      y: 15,
      scale: 2,
    });
  });

  it("倍率は変えない", () => {
    expect(panBy({ x: 0, y: 0, scale: 3 }, 100, 100).scale).toBe(3);
  });

  it("パンしてもワールド座標の見え方の相対関係は保たれる", () => {
    const before = { x: 0, y: 0, scale: 2 };
    const after = panBy(before, 30, 40);
    const world = { x: 5, y: 5 };
    expect(toScreen(after, world)).toEqual({
      x: toScreen(before, world).x + 30,
      y: toScreen(before, world).y + 40,
    });
  });
});

describe("zoomAt", () => {
  const anchor = { x: 400, y: 300 };

  it("カーソル位置のワールド座標を固定したまま拡大する", () => {
    const before: Viewport = { x: 20, y: -10, scale: 1.5 };
    const worldUnderCursor = toWorld(before, anchor);
    const after = zoomAt(before, anchor, 2);

    expect(after.scale).toBe(3);
    expect(toWorld(after, anchor).x).toBeCloseTo(worldUnderCursor.x, 10);
    expect(toWorld(after, anchor).y).toBeCloseTo(worldUnderCursor.y, 10);
  });

  it("カーソル位置のワールド座標を固定したまま縮小する", () => {
    const before: Viewport = { x: 20, y: -10, scale: 2 };
    const worldUnderCursor = toWorld(before, anchor);
    const after = zoomAt(before, anchor, 0.5);

    expect(after.scale).toBe(1);
    expect(toWorld(after, anchor).x).toBeCloseTo(worldUnderCursor.x, 10);
    expect(toWorld(after, anchor).y).toBeCloseTo(worldUnderCursor.y, 10);
  });

  it("上限を超える拡大は上限で止まる", () => {
    expect(zoomAt(createViewport(), anchor, MAX_SCALE * 100).scale).toBe(
      MAX_SCALE,
    );
  });

  it("下限を下回る縮小は下限で止まる", () => {
    expect(zoomAt(createViewport(), anchor, MIN_SCALE / 100).scale).toBe(
      MIN_SCALE,
    );
  });

  it("上限で止まった場合もカーソル位置は固定される", () => {
    const before: Viewport = { x: 0, y: 0, scale: MAX_SCALE };
    const worldUnderCursor = toWorld(before, anchor);
    const after = zoomAt(before, anchor, 4);
    expect(toWorld(after, anchor).x).toBeCloseTo(worldUnderCursor.x, 10);
    expect(after).toEqual(before);
  });
});

describe("visibleWorldRect", () => {
  it("等倍・原点では画面サイズと一致する", () => {
    expect(visibleWorldRect(createViewport(), 800, 600)).toEqual({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    });
  });

  it("拡大すると見えるワールド範囲は狭くなる", () => {
    expect(visibleWorldRect({ x: 0, y: 0, scale: 2 }, 800, 600)).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 300,
    });
  });

  it("平行移動を反映する", () => {
    expect(visibleWorldRect({ x: -100, y: -50, scale: 1 }, 800, 600)).toEqual({
      x: 100,
      y: 50,
      width: 800,
      height: 600,
    });
  });
});

describe("fitScaleToContent", () => {
  it("内容が画面より小さければ等倍のまま", () => {
    expect(
      fitScaleToContent({ x: 0, y: 0, width: 100, height: 100 }, 800, 600),
    ).toBe(1);
  });

  it("横に収まらない内容は幅基準で縮小する", () => {
    expect(
      fitScaleToContent({ x: 0, y: 0, width: 1600, height: 300 }, 800, 600),
    ).toBe(0.5);
  });

  it("縦に収まらない内容は高さ基準で縮小する", () => {
    expect(
      fitScaleToContent({ x: 0, y: 0, width: 400, height: 2400 }, 800, 600),
    ).toBe(0.25);
  });

  it("内容が空（幅も高さも 0）なら等倍を返す", () => {
    expect(fitScaleToContent({ x: 0, y: 0, width: 0, height: 0 }, 800, 600)).toBe(
      1,
    );
  });

  it("結果は倍率の範囲に収まる", () => {
    expect(
      fitScaleToContent({ x: 0, y: 0, width: 1e9, height: 1e9 }, 800, 600),
    ).toBe(MIN_SCALE);
  });
});
