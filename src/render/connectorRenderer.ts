/**
 * コネクタ（アイテム同士を結ぶ線）の描画。
 */

import {
  arrowHead,
  capLength,
  connectorEnds,
  type ConnectorPath,
} from "../domain/connectorPath";
import {
  DEFAULT_CONNECTOR_STROKE,
  type CapSize,
  type EndCap,
  type StrokeSettings,
} from "../domain/board";
import { CONNECTOR_HANDLE_SIZE } from "../domain/connectorHitTest";
import { dashPattern } from "./strokePattern";
import type { Point } from "../domain/geometry";
import { SELECTION_COLOR } from "./palette";

/** コネクタの線の色。 */
export const CONNECTOR_COLOR = "#6B7385";

/** 端点ハンドルの線の太さ (画面 px)。 */
const HANDLE_LINE_WIDTH = 2;

/** 折れ線の角の丸み（ワールド座標）。 */
const CORNER_RADIUS = 8;

export interface DrawConnectorOptions {
  readonly selected?: boolean;
  /** 線の見た目。省略時は既定の太さ・実線。 */
  readonly stroke?: StrokeSettings;
  /** 始点に付ける印。 */
  readonly startCap?: EndCap;
  /** 終点に付ける印。 */
  readonly endCap?: EndCap;
  /** 印の大きさ。 */
  readonly capSize?: CapSize;
}

/** コネクタ 1 本を描く。 */
export function drawConnector(
  ctx: CanvasRenderingContext2D,
  path: ConnectorPath,
  scale: number,
  options: DrawConnectorOptions = {},
): void {
  const stroke = options.stroke ?? DEFAULT_CONNECTOR_STROKE;
  ctx.strokeStyle = options.selected === true ? SELECTION_COLOR : CONNECTOR_COLOR;
  // 太さと破線の間隔は画面上で一定に見せたいので拡大率で割る
  ctx.lineWidth = stroke.strokeWidth / scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash(
    dashPattern(stroke.strokeStyle, stroke.strokeWidth, scale),
  );

  ctx.beginPath();
  if (path.kind === "curve") {
    ctx.moveTo(path.from.x, path.from.y);
    ctx.bezierCurveTo(
      path.control1.x,
      path.control1.y,
      path.control2.x,
      path.control2.y,
      path.to.x,
      path.to.y,
    );
  } else {
    tracePolyline(ctx, path.points);
  }
  ctx.stroke();
  // 矢印や丸は破線にしないので、ここで戻しておく
  ctx.setLineDash([]);

  const size =
    capLength(options.capSize ?? "medium", stroke.strokeWidth) / scale;
  drawCap(ctx, path, "from", options.startCap ?? "none", size);
  drawCap(ctx, path, "to", options.endCap ?? "none", size);
}

/** 指定した端に印を描く。線と同じ色で塗りつぶす。 */
function drawCap(
  ctx: CanvasRenderingContext2D,
  path: ConnectorPath,
  end: "from" | "to",
  cap: EndCap,
  size: number,
): void {
  if (cap === "none") {
    return;
  }
  const head = arrowHead(path, end, size);
  if (head === null) {
    return;
  }
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  if (cap === "circle") {
    // 丸は線の端に中心を置き、矢印と同じ大きさの指定で釣り合うようにする
    ctx.arc(head.tip.x, head.tip.y, size / 2, 0, Math.PI * 2);
  } else {
    ctx.moveTo(head.tip.x, head.tip.y);
    ctx.lineTo(head.left.x, head.left.y);
    ctx.lineTo(head.right.x, head.right.y);
    ctx.closePath();
  }
  ctx.fill();
}

/**
 * 折れ線を引く。角は少し丸める。
 * 直角のままだと図としては硬く、手書きのボードらしさから離れるため。
 */
function tracePolyline(
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
): void {
  let previous: Point | undefined;

  points.forEach((current, index) => {
    if (previous === undefined) {
      ctx.moveTo(current.x, current.y);
      previous = current;
      return;
    }
    const next = points[index + 1];
    if (next === undefined) {
      ctx.lineTo(current.x, current.y);
    } else {
      // 角では、手前と先の区間の短いほうに合わせた半径で丸める
      const radius = Math.min(
        CORNER_RADIUS,
        distance(previous, current) / 2,
        distance(current, next) / 2,
      );
      ctx.arcTo(current.x, current.y, next.x, next.y, radius);
    }
    previous = current;
  });
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * 選択中のコネクタの端点にハンドルを描く。
 * ここを掴んで別のアイテムへ運ぶと接続先を付け替えられる。
 */
export function drawConnectorHandles(
  ctx: CanvasRenderingContext2D,
  path: ConnectorPath,
  scale: number,
): void {
  const radius = CONNECTOR_HANDLE_SIZE / scale / 2;

  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = HANDLE_LINE_WIDTH / scale;

  for (const { point } of connectorEnds(path)) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
