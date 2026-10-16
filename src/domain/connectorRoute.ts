/**
 * 図形を避けて線を通す経路探索。
 *
 * 線の端を図形の辺（接続ポイント）に指定すると、その辺が相手と反対を
 * 向いていることがある。そのまま引くと線が図形の下を通って隠れ、別の辺から
 * 出ているように見えてしまう。図形を障害物とみなし、周りを回り込む
 * 直交した経路を探す。
 *
 * 通り道は、図形の辺から一定の距離だけ離れた縦横の線（と図形の間の真ん中）
 * からなる格子に限る。その上で、長さと曲がる回数が少ない経路を選ぶ。
 */

import type { Point, Rect } from "./geometry";

/**
 * 辺から垂直に出す最短の長さ（ワールド px）。図形の脇を通るときの間隔も兼ねる。
 * 接続ポイントのすぐ脇で折れると、線が図形に沿って見えてしまう。
 */
export const ROUTE_STUB = 24;

/** 曲がる 1 回あたりの重み（長さ換算）。少ない曲がりの経路を選ばせる。 */
const BEND_PENALTY = 40;

/**
 * 図形の脇ぎりぎりを通る区間に足す重み。
 * 長さも曲がる回数も同じなら、図形に沿わず間を通る経路を選ばせる。
 */
const HUG_PENALTY = 1;

/**
 * 線分が矩形の内側を通るか。辺に沿う・角に触れるだけなら通らないとみなす。
 * Liang–Barsky の線分クリッピングで、内側に残る区間があるかを調べる。
 */
export function segmentCrossesRect(a: Point, b: Point, rect: Rect): boolean {
  // 辺の上を通るだけの線を「通る」と数えないよう、わずかに内側で判定する
  const inset = 0.5;
  const minX = rect.x + inset;
  const maxX = rect.x + rect.width - inset;
  const minY = rect.y + inset;
  const maxY = rect.y + rect.height - inset;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let enter = 0;
  let leave = 1;
  for (const [p, q] of [
    [-dx, a.x - minX],
    [dx, maxX - a.x],
    [-dy, a.y - minY],
    [dy, maxY - a.y],
  ] as const) {
    if (p === 0) {
      if (q < 0) {
        return false;
      }
      continue;
    }
    const t = q / p;
    if (p < 0) {
      enter = Math.max(enter, t);
    } else {
      leave = Math.min(leave, t);
    }
  }
  return enter < leave;
}

/** 線分がどれかの矩形の内側を通るか。 */
function blocked(a: Point, b: Point, obstacles: readonly Rect[]): boolean {
  return obstacles.some((rect) => segmentCrossesRect(a, b, rect));
}

/** 点がどれかの矩形の内側にあるか。 */
function insideAny(point: Point, obstacles: readonly Rect[]): boolean {
  return obstacles.some(
    (rect) =>
      point.x > rect.x &&
      point.x < rect.x + rect.width &&
      point.y > rect.y &&
      point.y < rect.y + rect.height,
  );
}

/** 進む向き（右・下・左・上）。 */
function directionOf(from: Point, to: Point): number {
  if (to.x > from.x) {
    return 0;
  }
  if (to.y > from.y) {
    return 1;
  }
  return to.x < from.x ? 2 : 3;
}

/** 水平・垂直の区間が、図形の脇ぎりぎり（`ROUTE_STUB` 以内）を通るか。 */
function hugs(a: Point, b: Point, obstacles: readonly Rect[]): boolean {
  const near = ROUTE_STUB + 0.5;
  return obstacles.some((rect) => {
    if (a.y === b.y) {
      const overlaps =
        Math.max(a.x, b.x) > rect.x && Math.min(a.x, b.x) < rect.x + rect.width;
      return (
        overlaps &&
        (Math.abs(a.y - rect.y) < near ||
          Math.abs(a.y - (rect.y + rect.height)) < near)
      );
    }
    const overlaps =
      Math.max(a.y, b.y) > rect.y && Math.min(a.y, b.y) < rect.y + rect.height;
    return (
      overlaps &&
      (Math.abs(a.x - rect.x) < near ||
        Math.abs(a.x - (rect.x + rect.width)) < near)
    );
  });
}

/** 途中の点のうち、前後と一直線に並ぶものを除く。 */
export function simplifyRoute(points: readonly Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const previous = result.at(-1);
    if (previous !== undefined && previous.x === point.x && previous.y === point.y) {
      continue;
    }
    const beforePrevious = result.at(-2);
    if (
      previous !== undefined &&
      beforePrevious !== undefined &&
      ((beforePrevious.x === previous.x && previous.x === point.x) ||
        (beforePrevious.y === previous.y && previous.y === point.y))
    ) {
      result[result.length - 1] = point;
      continue;
    }
    result.push(point);
  }
  return result;
}

/**
 * 図形を避けて、2 つの辺の接続ポイントを直交する折れ線で結ぶ。
 *
 * どちらの端も、接続ポイントから縦か横にまっすぐ出た先の点を経由する。
 * 通れる道が無い（図形が重なって接続ポイントがふさがれている）ときは null。
 * @param first 始点から出た先の点。図形の外にあること
 * @param last 終点へ入る手前の点。図形の外にあること
 */
export function routeAround(
  start: Point,
  first: Point,
  end: Point,
  last: Point,
  obstacles: readonly Rect[],
): Point[] | null {

  // 通り道の候補: 端から出た点の縦横、図形の周り、図形の間の真ん中
  const xs = new Set<number>([first.x, last.x]);
  const ys = new Set<number>([first.y, last.y]);
  for (const rect of obstacles) {
    xs.add(rect.x - ROUTE_STUB);
    xs.add(rect.x + rect.width + ROUTE_STUB);
    ys.add(rect.y - ROUTE_STUB);
    ys.add(rect.y + rect.height + ROUTE_STUB);
    for (const other of obstacles) {
      const gapX = other.x - (rect.x + rect.width);
      if (gapX > 0) {
        xs.add(rect.x + rect.width + gapX / 2);
      }
      const gapY = other.y - (rect.y + rect.height);
      if (gapY > 0) {
        ys.add(rect.y + rect.height + gapY / 2);
      }
    }
  }
  const columns = [...xs].sort((a, b) => a - b);
  const rows = [...ys].sort((a, b) => a - b);

  // 格子の点。図形の内側にある点は使わない（始点・終点の脇の点は除く）
  const nodes: Point[] = [];
  const indexOf = new Map<string, number>();
  for (const y of rows) {
    for (const x of columns) {
      const point = { x, y };
      const isEnd =
        (x === first.x && y === first.y) || (x === last.x && y === last.y);
      if (!isEnd && insideAny(point, obstacles)) {
        continue;
      }
      indexOf.set(`${x},${y}`, nodes.length);
      nodes.push(point);
    }
  }
  const startIndex = indexOf.get(`${first.x},${first.y}`) as number;
  const goalIndex = indexOf.get(`${last.x},${last.y}`) as number;

  /** 隣の格子の点（上下左右で最も近いもの）。 */
  const neighbors = (point: Point): Point[] => {
    const column = columns.indexOf(point.x);
    const row = rows.indexOf(point.y);
    const candidates = [
      { x: columns[column + 1], y: point.y },
      { x: columns[column - 1], y: point.y },
      { x: point.x, y: rows[row + 1] },
      { x: point.x, y: rows[row - 1] },
    ];
    return candidates.flatMap((candidate) =>
      candidate.x === undefined || candidate.y === undefined
        ? []
        : [{ x: candidate.x, y: candidate.y }],
    );
  };

  // 向きごとの最短の重み（ダイクストラ法）。点は高々数十なので素朴に探す
  const states = nodes.length * 4;
  const cost = new Array<number>(states).fill(Number.POSITIVE_INFINITY);
  const previous = new Array<number>(states).fill(-1);
  const done = new Array<boolean>(states).fill(false);
  const startState = startIndex * 4 + directionOf(start, first);
  cost[startState] = 0;
  const arrival = directionOf(last, end);

  let goalState = -1;
  for (;;) {
    let current = -1;
    for (let state = 0; state < states; state += 1) {
      if (!done[state] && (current === -1 || cost[state]! < cost[current]!)) {
        current = state;
      }
    }
    if (current === -1 || cost[current] === Number.POSITIVE_INFINITY) {
      break;
    }
    done[current] = true;
    const node = Math.floor(current / 4);
    const heading = current % 4;
    if (node === goalIndex) {
      goalState = current;
      break;
    }
    const point = nodes[node] as Point;
    for (const next of neighbors(point)) {
      const nextIndex = indexOf.get(`${next.x},${next.y}`);
      if (nextIndex === undefined || blocked(point, next, obstacles)) {
        continue;
      }
      const direction = directionOf(point, next);
      const length = Math.abs(next.x - point.x) + Math.abs(next.y - point.y);
      let weight =
        length +
        (direction === heading ? 0 : BEND_PENALTY) +
        (hugs(point, next, obstacles) ? HUG_PENALTY : 0);
      // 終点の脇に着いたら、最後に辺へ入る向きと揃っているかも数える
      if (nextIndex === goalIndex && direction !== arrival) {
        weight += BEND_PENALTY;
      }
      const nextState = nextIndex * 4 + direction;
      const total = cost[current]! + weight;
      if (total < cost[nextState]!) {
        cost[nextState] = total;
        previous[nextState] = current;
      }
    }
  }
  if (goalState === -1) {
    return null;
  }

  const route: Point[] = [end];
  for (let state = goalState; state !== -1; state = previous[state]!) {
    route.push(nodes[Math.floor(state / 4)] as Point);
  }
  route.push(start);
  return simplifyRoute(route.reverse());
}

/**
 * 経路を、見通せるところまで斜めにまっすぐつなぎ直す（直線の線用）。
 *
 * 先頭の `keepStart` 個と末尾の `keepEnd` 個の点はそのまま残す
 * （接続ポイントの辺から垂直に出入りする部分）。間の点は、図形を
 * 横切らずに見通せる最も先の点へ飛ばして減らす。
 */
export function straightenRoute(
  route: readonly Point[],
  obstacles: readonly Rect[],
  keepStart: number,
  keepEnd: number,
): Point[] {
  if (route.length <= keepStart + keepEnd) {
    return [...route];
  }
  const tailStart = route.length - keepEnd;
  const result = route.slice(0, keepStart);
  let index = keepStart - 1;
  while (index < tailStart) {
    let reach = index + 1;
    for (let candidate = tailStart; candidate > index + 1; candidate -= 1) {
      if (!blocked(route[index] as Point, route[candidate] as Point, obstacles)) {
        reach = candidate;
        break;
      }
    }
    result.push(route[reach] as Point);
    index = reach;
  }
  result.push(...route.slice(tailStart + 1));
  return result;
}
