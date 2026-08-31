/**
 * アイテムのサイズ変更（リサイズ）の計算。
 *
 * ハンドルの位置も当たり判定もリサイズ後の矩形も、すべて純関数として
 * ここに置く。Canvas なしでテストできるようにするため。
 */

import { type Point, type Rect } from "./geometry";

/** リサイズハンドルの方向。 */
export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

/** 8 方向のハンドル。 */
export const RESIZE_HANDLES: readonly ResizeHandle[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];

/** アイテムの最小の辺の長さ。これ以下には縮められない。 */
export const MIN_ITEM_SIZE = 24;

/** ハンドルの描画サイズ (画面 px)。 */
export const HANDLE_SIZE = 8;

/**
 * ハンドルの当たり判定の一辺 (画面 px)。
 * 見た目より広めにして、正確に狙わなくても掴めるようにする。
 */
export const HANDLE_HIT_SIZE = 14;

/** ハンドルの位置（ワールド座標）。 */
export function handlePosition(bounds: Rect, handle: ResizeHandle): Point {
  const left = bounds.x;
  const right = bounds.x + bounds.width;
  const top = bounds.y;
  const bottom = bounds.y + bounds.height;
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  return {
    x: handle.includes("w") ? left : handle.includes("e") ? right : centerX,
    y: handle.includes("n") ? top : handle.includes("s") ? bottom : centerY,
  };
}

/** ハンドルに対応するマウスカーソル。 */
export function cursorForHandle(handle: ResizeHandle): string {
  switch (handle) {
    case "nw":
    case "se":
      return "nwse-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "n":
    case "s":
      return "ns-resize";
    default:
      return "ew-resize";
  }
}

/**
 * 点がどのハンドルの上にあるかを判定する。
 *
 * ハンドルは拡大率によらず一定の大きさで描くため、当たり判定の範囲も
 * 画面上の大きさを基準にワールド座標へ換算する。
 * 縮小表示や小さいアイテムでは隣のハンドルと判定範囲が重なるため、
 * 範囲に入ったものの中から中心が最も近いハンドルを選ぶ。
 */
export function hitTestHandle(
  bounds: Rect,
  point: Point,
  scale: number,
): ResizeHandle | undefined {
  const half = HANDLE_HIT_SIZE / scale / 2;
  let nearest: ResizeHandle | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const handle of RESIZE_HANDLES) {
    const center = handlePosition(bounds, handle);
    const dx = Math.abs(point.x - center.x);
    const dy = Math.abs(point.y - center.y);
    if (dx > half || dy > half) {
      continue;
    }
    const distance = dx * dx + dy * dy;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = handle;
    }
  }
  return nearest;
}

export interface ResizeOptions {
  /**
   * 維持すべき縦横比 (幅 / 高さ)。
   * 画像は原寸の比を渡し、常に比を保ってリサイズする。
   */
  readonly aspectRatio?: number;
}

/**
 * ハンドルをドラッグしたときの新しい矩形を返す。
 *
 * 掴んだハンドルの反対側の辺（角なら反対の角）を固定点とし、そこを
 * 動かさないままサイズを変える。
 */
export function resizeRect(
  bounds: Rect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  options: ResizeOptions = {},
): Rect {
  const movesWest = handle.includes("w");
  const movesEast = handle.includes("e");
  const movesNorth = handle.includes("n");
  const movesSouth = handle.includes("s");

  let width = bounds.width + (movesEast ? dx : 0) - (movesWest ? dx : 0);
  let height = bounds.height + (movesSouth ? dy : 0) - (movesNorth ? dy : 0);

  const ratio = options.aspectRatio;
  const keepsRatio = ratio !== undefined && ratio > 0;

  if (keepsRatio) {
    const changesVertically = movesNorth || movesSouth;
    const changesHorizontally = movesEast || movesWest;
    if (changesVertically && changesHorizontally) {
      // 角のドラッグでは、変化量の大きいほうの辺を主にする。
      // そうしないと斜めに引いたときの追従が鈍く感じられる。
      if (
        Math.abs(width - bounds.width) >= Math.abs(height - bounds.height)
      ) {
        height = width / ratio;
      } else {
        width = height * ratio;
      }
    } else if (changesVertically) {
      width = height * ratio;
    } else {
      height = width / ratio;
    }
  }

  width = Math.max(width, MIN_ITEM_SIZE);
  height = Math.max(height, MIN_ITEM_SIZE);

  if (keepsRatio) {
    // 最小サイズで丸めた結果として比が崩れることがあるので合わせ直す。
    // 崩れる方向は縦横比によって変わるため、大きいほうに合わせる。
    if (width / height > ratio) {
      height = width / ratio;
    } else {
      width = height * ratio;
    }
  }

  // 掴んだ側と反対の辺を固定点にする
  const fixedX = movesWest ? bounds.x + bounds.width : bounds.x;
  const fixedY = movesNorth ? bounds.y + bounds.height : bounds.y;

  return {
    x: movesWest ? fixedX - width : fixedX,
    y: movesNorth ? fixedY - height : fixedY,
    width,
    height,
  };
}
