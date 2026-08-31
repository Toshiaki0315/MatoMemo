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

/** 線の種類。 */
export const STROKE_STYLES = ["solid", "dashed", "dotted", "dashDot"] as const;
export type StrokeStyle = (typeof STROKE_STYLES)[number];

/** 選べる線の太さ (px)。 */
export const STROKE_WIDTHS = [1, 2, 3, 5, 8] as const;

/** 線の見た目。図形の枠線とコネクタで共通に使う。 */
export interface StrokeSettings {
  /** 太さ (画面 px)。拡大率によらず一定に見せる。 */
  readonly strokeWidth: number;
  readonly strokeStyle: StrokeStyle;
}

/** 図形の枠線の既定。 */
export const DEFAULT_STROKE: StrokeSettings = {
  strokeWidth: 1,
  strokeStyle: "solid",
};

/** コネクタの既定。図形の枠より少し太くして線として見えやすくする。 */
export const DEFAULT_CONNECTOR_STROKE: StrokeSettings = {
  strokeWidth: 2,
  strokeStyle: "solid",
};

/** コネクタの端に付ける印。 */
export const END_CAPS = ["none", "arrow", "circle"] as const;
export type EndCap = (typeof END_CAPS)[number];

/** 端の印の大きさ。 */
export const CAP_SIZES = ["small", "medium", "large"] as const;
export type CapSize = (typeof CAP_SIZES)[number];

/** テキストの書体。 */
export interface TextStyle {
  readonly fontFamily: string;
  readonly fontSize: number;
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
/** 単体テキストの既定サイズ。 */
export const DEFAULT_FONT_SIZE = 20;
/** 付箋・図形に内包するテキストの既定サイズ。枠に収めたいので少し小さい。 */
export const DEFAULT_ITEM_FONT_SIZE = 16;

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
export interface StickyNoteItem extends ItemBase, TextAlignment, TextStyle {
  readonly type: "sticky";
  readonly text: string;
  readonly color: StickyColor;
}

/** 図形（矩形・円）。テキストを内包できる。 */
export interface ShapeItem
  extends ItemBase,
    TextAlignment,
    TextStyle,
    StrokeSettings {
  readonly type: "shape";
  readonly shape: ShapeKind;
  readonly text: string;
  /** 塗りの色。null なら塗らない（背景が透ける）。 */
  readonly fill: string | null;
}

/** 単体のテキスト。 */
export interface TextItem extends ItemBase, TextAlignment, TextStyle {
  readonly type: "text";
  readonly text: string;
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
export interface Connector extends StrokeSettings {
  readonly id: ConnectorId;
  readonly kind: ConnectorKind;
  readonly fromItemId: ItemId;
  readonly toItemId: ItemId;
  /** 始点に付ける印。 */
  readonly startCap: EndCap;
  /** 終点に付ける印。 */
  readonly endCap: EndCap;
  /** 両端の印の大きさ。 */
  readonly capSize: CapSize;
  /**
   * 折れ線の中間の線の位置。始点側 0〜終点側 1 の割合。
   * 割合で持つことで、アイテムを動かしても折れ方の按分が保たれる。
   * 折れ線以外の種類では使わない。
   */
  readonly bend: number;
}

/** 折れ線の中間の線の既定の位置（ちょうど真ん中）。 */
export const DEFAULT_BEND = 0.5;

/** 中間の線を端へ寄せられる限界。0 や 1 まで寄せると経路が潰れてしまう。 */
const BEND_MARGIN = 0.02;

/** 中間の線の位置を有効な範囲に丸める。 */
export function clampBend(bend: number): number {
  return Math.min(Math.max(bend, BEND_MARGIN), 1 - BEND_MARGIN);
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

/** テキストの配置と書体を指定する引数。 */
interface TextStyleParams {
  readonly align?: TextAlign;
  readonly verticalAlign?: TextVerticalAlign;
  readonly fontFamily?: string;
  readonly fontSize?: number;
}

/**
 * 配置の既定値を決める。
 * 付箋と図形は中央、単体テキストは左上を既定とし、
 * それぞれの見た目の慣習に合わせる。
 */
function textSettingsOf(
  params: TextStyleParams,
  fallback: TextAlignment & TextStyle,
): TextAlignment & TextStyle {
  return {
    align: params.align ?? fallback.align,
    verticalAlign: params.verticalAlign ?? fallback.verticalAlign,
    fontFamily: params.fontFamily ?? fallback.fontFamily,
    fontSize: params.fontSize ?? fallback.fontSize,
  };
}

/** 付箋・図形の内部テキストの既定。 */
export const BOXED_TEXT_DEFAULTS: TextAlignment & TextStyle = {
  align: "center",
  verticalAlign: "middle",
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: DEFAULT_ITEM_FONT_SIZE,
};

/** 単体テキストの既定。 */
export const STANDALONE_TEXT_DEFAULTS: TextAlignment & TextStyle = {
  align: "left",
  verticalAlign: "top",
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: DEFAULT_FONT_SIZE,
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
    TextStyleParams & {
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
    ...textSettingsOf(params, BOXED_TEXT_DEFAULTS),
  };
}

/** 図形の既定の塗り色。 */
export const DEFAULT_SHAPE_FILL = "#FFFFFF";

export function createShape(
  params: ItemBaseParams &
    TextStyleParams &
    Partial<StrokeSettings> & {
      readonly shape: ShapeKind;
      readonly text?: string;
      readonly fill?: string | null;
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
    fill: params.fill === undefined ? DEFAULT_SHAPE_FILL : params.fill,
    strokeWidth: params.strokeWidth ?? DEFAULT_STROKE.strokeWidth,
    strokeStyle: params.strokeStyle ?? DEFAULT_STROKE.strokeStyle,
    ...textSettingsOf(params, BOXED_TEXT_DEFAULTS),
  };
}

export function createText(
  params: ItemBaseParams & TextStyleParams & { readonly text?: string },
): TextItem {
  return {
    id: params.id,
    type: "text",
    x: params.x,
    y: params.y,
    width: params.width ?? DEFAULT_TEXT_WIDTH,
    height: params.height ?? DEFAULT_TEXT_HEIGHT,
    text: params.text ?? "",
    ...textSettingsOf(params, STANDALONE_TEXT_DEFAULTS),
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
  readonly startCap?: EndCap;
  readonly endCap?: EndCap;
  readonly capSize?: CapSize;
  readonly strokeWidth?: number;
  readonly strokeStyle?: StrokeStyle;
  readonly bend?: number;
}): Connector {
  return {
    id: params.id,
    kind: params.kind ?? "straight",
    fromItemId: params.fromItemId,
    toItemId: params.toItemId,
    startCap: params.startCap ?? "none",
    endCap: params.endCap ?? "none",
    capSize: params.capSize ?? "medium",
    strokeWidth: params.strokeWidth ?? DEFAULT_CONNECTOR_STROKE.strokeWidth,
    strokeStyle: params.strokeStyle ?? DEFAULT_CONNECTOR_STROKE.strokeStyle,
    bend: params.bend ?? DEFAULT_BEND,
  };
}
