/**
 * ボードのドメインモデル。
 *
 * DOM / Canvas / Tauri に依存しない純粋なデータ構造と、その生成関数のみを置く。
 *
 * 重なり順（Z-index）は `Board.items` の配列順そのもので表現する。
 * 添字 0 が最背面、末尾が最前面。専用のフィールドを持たせると配列順との
 * 二重管理になり不整合を招くため、順序は配列に一本化している。
 */

/** アイテムの識別子。 */
export type ItemId = string;

/** コネクタの識別子。 */
export type ConnectorId = string;

/** 付箋の色。視認性を優先した薄いパステル 6 色。 */
export const STICKY_COLORS = [
  "yellow",
  "orange",
  "pink",
  "purple",
  "blue",
  "green",
] as const;

export type StickyColor = (typeof STICKY_COLORS)[number];

/** 図形の種類。 */
export type ShapeKind = "rectangle" | "circle";

/** コネクタの種類。 */
export type ConnectorKind = "straight" | "polyline" | "curved";

/** テキストの横位置。 */
export const TEXT_ALIGNS = ["left", "center", "right"] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];

/** テキストの縦位置。 */
export const TEXT_VERTICAL_ALIGNS = ["top", "middle", "bottom"] as const;
export type TextVerticalAlign = (typeof TEXT_VERTICAL_ALIGNS)[number];

/** テキストを内包するアイテムが共通で持つ配置の設定。 */
export interface TextAlignment {
  readonly align: TextAlign;
  readonly verticalAlign: TextVerticalAlign;
}

/** 既定のボード名。 */
export const DEFAULT_BOARD_NAME = "無題のボード";

/** 付箋の既定の一辺の長さ。 */
export const DEFAULT_STICKY_SIZE = 200;

/** 図形の既定の一辺の長さ。 */
export const DEFAULT_SHAPE_SIZE = 160;

/** テキストアイテムの既定サイズ。 */
export const DEFAULT_TEXT_WIDTH = 240;
export const DEFAULT_TEXT_HEIGHT = 48;

/** テキストの既定フォント。 */
export const DEFAULT_FONT_FAMILY = "Hiragino Sans";
export const DEFAULT_FONT_SIZE = 20;

/** 画像を配置するときの既定の最大辺長。これを超える画像は縮小して配置する。 */
export const DEFAULT_IMAGE_MAX_EDGE = 480;

/** すべてのアイテムが持つ共通のプロパティ。 */
export interface ItemBase {
  readonly id: ItemId;
  /** ワールド座標における左上の位置。 */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** 付箋。 */
export interface StickyNoteItem extends ItemBase, TextAlignment {
  readonly type: "sticky";
  readonly text: string;
  readonly color: StickyColor;
}

/** 図形（矩形・円）。テキストを内包できる。 */
export interface ShapeItem extends ItemBase, TextAlignment {
  readonly type: "shape";
  readonly shape: ShapeKind;
  readonly text: string;
}

/** 単体のテキスト。 */
export interface TextItem extends ItemBase, TextAlignment {
  readonly type: "text";
  readonly text: string;
  readonly fontFamily: string;
  readonly fontSize: number;
}

/** 画像。リサイズ時は常に縦横比を維持する（`naturalWidth` / `naturalHeight` が基準）。 */
export interface ImageItem extends ItemBase {
  readonly type: "image";
  /** 画像の実体。data URL として埋め込む。 */
  readonly source: string;
  readonly naturalWidth: number;
  readonly naturalHeight: number;
}

/** キャンバスに配置できるアイテム。 */
export type Item = StickyNoteItem | ShapeItem | TextItem | ImageItem;

/** アイテムの種類を表す判別子。 */
export type ItemType = Item["type"];

/** アイテム同士を結ぶコネクタ。 */
export interface Connector {
  readonly id: ConnectorId;
  readonly kind: ConnectorKind;
  readonly fromItemId: ItemId;
  readonly toItemId: ItemId;
  /** 始点に矢印を描くか。 */
  readonly arrowStart: boolean;
  /** 終点に矢印を描くか。 */
  readonly arrowEnd: boolean;
}

/** ホワイトボード 1 枚分の状態。 */
export interface Board {
  readonly id: string;
  readonly name: string;
  /** 背面から前面の順に並ぶアイテム。 */
  readonly items: readonly Item[];
  readonly connectors: readonly Connector[];
}

/** アイテム生成関数に共通の引数。 */
interface ItemBaseParams {
  readonly id: ItemId;
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
}

/** テキストの配置を指定する引数。 */
interface TextAlignmentParams {
  readonly align?: TextAlign;
  readonly verticalAlign?: TextVerticalAlign;
}

/**
 * 配置の既定値を決める。
 * 付箋と図形は中央、単体テキストは左上を既定とし、
 * それぞれの見た目の慣習に合わせる。
 */
function alignmentOf(
  params: TextAlignmentParams,
  fallback: TextAlignment,
): TextAlignment {
  return {
    align: params.align ?? fallback.align,
    verticalAlign: params.verticalAlign ?? fallback.verticalAlign,
  };
}

const BOXED_TEXT_ALIGNMENT: TextAlignment = {
  align: "center",
  verticalAlign: "middle",
};

const STANDALONE_TEXT_ALIGNMENT: TextAlignment = {
  align: "left",
  verticalAlign: "top",
};

export function createBoard(params: {
  readonly id: string;
  readonly name?: string;
}): Board {
  return {
    id: params.id,
    name: params.name ?? DEFAULT_BOARD_NAME,
    items: [],
    connectors: [],
  };
}

export function createStickyNote(
  params: ItemBaseParams &
    TextAlignmentParams & {
      readonly text?: string;
      readonly color?: StickyColor;
    },
): StickyNoteItem {
  return {
    id: params.id,
    type: "sticky",
    x: params.x,
    y: params.y,
    width: params.width ?? DEFAULT_STICKY_SIZE,
    height: params.height ?? DEFAULT_STICKY_SIZE,
    text: params.text ?? "",
    color: params.color ?? "yellow",
    ...alignmentOf(params, BOXED_TEXT_ALIGNMENT),
  };
}

export function createShape(
  params: ItemBaseParams &
    TextAlignmentParams & {
      readonly shape: ShapeKind;
      readonly text?: string;
    },
): ShapeItem {
  return {
    id: params.id,
    type: "shape",
    shape: params.shape,
    x: params.x,
    y: params.y,
    width: params.width ?? DEFAULT_SHAPE_SIZE,
    height: params.height ?? DEFAULT_SHAPE_SIZE,
    text: params.text ?? "",
    ...alignmentOf(params, BOXED_TEXT_ALIGNMENT),
  };
}

export function createText(
  params: ItemBaseParams &
    TextAlignmentParams & {
      readonly text?: string;
      readonly fontFamily?: string;
      readonly fontSize?: number;
    },
): TextItem {
  return {
    id: params.id,
    type: "text",
    x: params.x,
    y: params.y,
    width: params.width ?? DEFAULT_TEXT_WIDTH,
    height: params.height ?? DEFAULT_TEXT_HEIGHT,
    text: params.text ?? "",
    fontFamily: params.fontFamily ?? DEFAULT_FONT_FAMILY,
    fontSize: params.fontSize ?? DEFAULT_FONT_SIZE,
    ...alignmentOf(params, STANDALONE_TEXT_ALIGNMENT),
  };
}

/**
 * 原寸を `DEFAULT_IMAGE_MAX_EDGE` に収まるよう縦横比を保って縮小する。
 * 既に収まっている場合は原寸のまま返す。
 */
function fitWithinMaxEdge(
  naturalWidth: number,
  naturalHeight: number,
): { width: number; height: number } {
  const longestEdge = Math.max(naturalWidth, naturalHeight);
  if (longestEdge <= DEFAULT_IMAGE_MAX_EDGE) {
    return { width: naturalWidth, height: naturalHeight };
  }
  const scale = DEFAULT_IMAGE_MAX_EDGE / longestEdge;
  return {
    width: naturalWidth * scale,
    height: naturalHeight * scale,
  };
}

export function createImage(
  params: ItemBaseParams & {
    readonly source: string;
    readonly naturalWidth: number;
    readonly naturalHeight: number;
  },
): ImageItem {
  const fitted = fitWithinMaxEdge(params.naturalWidth, params.naturalHeight);
  return {
    id: params.id,
    type: "image",
    x: params.x,
    y: params.y,
    width: params.width ?? fitted.width,
    height: params.height ?? fitted.height,
    source: params.source,
    naturalWidth: params.naturalWidth,
    naturalHeight: params.naturalHeight,
  };
}

export function createConnector(params: {
  readonly id: ConnectorId;
  readonly fromItemId: ItemId;
  readonly toItemId: ItemId;
  readonly kind?: ConnectorKind;
  readonly arrowStart?: boolean;
  readonly arrowEnd?: boolean;
}): Connector {
  return {
    id: params.id,
    kind: params.kind ?? "straight",
    fromItemId: params.fromItemId,
    toItemId: params.toItemId,
    arrowStart: params.arrowStart ?? false,
    arrowEnd: params.arrowEnd ?? false,
  };
}
