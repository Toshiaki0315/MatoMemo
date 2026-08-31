/**
 * ボードのシリアライズと、読み込んだファイルの検証。
 *
 * 保存ファイルはユーザーが直接編集できる普通の JSON であり、破損や手編集による
 * 不正なデータが入り込みうる。そのため読み込み時は入力を一切信用せず、
 * すべてのフィールドを検証してから `Board` を組み立てる。
 *
 * 検出した問題は最初の 1 件で中断せず可能な限り集めてから報告する。
 * ユーザーがファイルを手で直すとき、問題を一度に把握できるほうが親切なため。
 */

import {
  BOXED_TEXT_DEFAULTS,
  clampBend,
  DEFAULT_BEND,
  DEFAULT_CONNECTOR_STROKE,
  DEFAULT_SHAPE_FILL,
  DEFAULT_STROKE,
  CAP_SIZES,
  END_CAPS,
  STANDALONE_TEXT_DEFAULTS,
  STICKY_COLORS,
  STROKE_STYLES,
  TEXT_ALIGNS,
  TEXT_VERTICAL_ALIGNS,
  type Board,
  type Connector,
  type ConnectorKind,
  type Item,
  type ShapeKind,
  type CapSize,
  type EndCap,
  type StickyColor,
  type StrokeSettings,
  type StrokeStyle,
  type TextAlign,
  type TextAlignment,
  type TextStyle,
  type TextVerticalAlign,
} from "./board";

/** 保存ファイルのスキーマバージョン。破壊的変更のたびに増やす。 */
export const SCHEMA_VERSION = 1;

/** 保存ファイルの拡張子。 */
export const BOARD_FILE_EXTENSION = "matomemo";

const SHAPE_KINDS: readonly ShapeKind[] = ["rectangle", "circle"];
const CONNECTOR_KINDS: readonly ConnectorKind[] = [
  "straight",
  "polyline",
  "curved",
];

/** ボードファイルの読み込みに失敗したことを表すエラー。 */
export class BoardFileError extends Error {
  /** 検出した個々の問題。ファイル全体が読めない場合は空になる。 */
  readonly issues: readonly string[];

  constructor(message: string, issues: readonly string[] = []) {
    super(message);
    this.name = "BoardFileError";
    this.issues = issues;
  }
}

/** 検証中に集めた問題のリスト。 */
type Issues = string[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** JSON に埋め込める形に値を整形する（エラーメッセージ用）。 */
function describe(value: unknown): string {
  return JSON.stringify(value) ?? String(value);
}

function readString(
  source: Record<string, unknown>,
  key: string,
  path: string,
  issues: Issues,
): string {
  const value = source[key];
  if (typeof value !== "string") {
    issues.push(`${path}.${key} は文字列である必要があります`);
    return "";
  }
  return value;
}

function readId(
  source: Record<string, unknown>,
  key: string,
  path: string,
  issues: Issues,
): string {
  const value = source[key];
  if (typeof value !== "string" || value.length === 0) {
    issues.push(`${path}.${key} は空でない文字列である必要があります`);
    return "";
  }
  return value;
}

function readNumber(
  source: Record<string, unknown>,
  key: string,
  path: string,
  issues: Issues,
  min?: number,
): number {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push(`${path}.${key} は有限の数値である必要があります`);
    return min ?? 0;
  }
  if (min !== undefined && value < min) {
    issues.push(`${path}.${key} は ${min} 以上である必要があります`);
    return min;
  }
  return value;
}

function readEnum<T extends string>(
  source: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T,
  path: string,
  issues: Issues,
): T {
  const value = source[key];
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    issues.push(`${path}.${key} が未知の値です: ${describe(value)}`);
    return fallback;
  }
  return value as T;
}

/**
 * 線の見た目を読み出す。
 * 後から追加した項目なので、無い場合は用途ごとの既定値で補う。
 */
function readStroke(
  source: Record<string, unknown>,
  fallback: StrokeSettings,
  path: string,
  issues: Issues,
): StrokeSettings {
  return {
    strokeWidth:
      source["strokeWidth"] === undefined
        ? fallback.strokeWidth
        : readNumber(source, "strokeWidth", path, issues, 1),
    strokeStyle:
      source["strokeStyle"] === undefined
        ? fallback.strokeStyle
        : readEnum<StrokeStyle>(
            source,
            "strokeStyle",
            STROKE_STYLES,
            fallback.strokeStyle,
            path,
            issues,
          ),
  };
}

/**
 * 図形の塗りを読み出す。
 * null は「塗らない」を表す。項目が無ければ以前の見た目（白）にする。
 */
function readFill(
  source: Record<string, unknown>,
  path: string,
  issues: Issues,
): string | null {
  const value = source["fill"];
  if (value === undefined) {
    return DEFAULT_SHAPE_FILL;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    issues.push(`${path}.fill は色の文字列か null である必要があります`);
    return DEFAULT_SHAPE_FILL;
  }
  return value;
}

/**
 * テキストの配置と書体を読み出す。
 * 後から追加した項目なので、無い場合は種類ごとの既定値で補う。
 */
function readTextSettings(
  source: Record<string, unknown>,
  fallback: TextAlignment & TextStyle,
  path: string,
  issues: Issues,
): TextAlignment & TextStyle {
  return {
    align:
      source["align"] === undefined
        ? fallback.align
        : readEnum<TextAlign>(
            source,
            "align",
            TEXT_ALIGNS,
            fallback.align,
            path,
            issues,
          ),
    verticalAlign:
      source["verticalAlign"] === undefined
        ? fallback.verticalAlign
        : readEnum<TextVerticalAlign>(
            source,
            "verticalAlign",
            TEXT_VERTICAL_ALIGNS,
            fallback.verticalAlign,
            path,
            issues,
          ),
    fontFamily:
      source["fontFamily"] === undefined
        ? fallback.fontFamily
        : readString(source, "fontFamily", path, issues),
    fontSize:
      source["fontSize"] === undefined
        ? fallback.fontSize
        : readNumber(source, "fontSize", path, issues, 1),
  };
}

/** 1 件のアイテムを検証する。復元できない場合は null を返す。 */
function parseItem(raw: unknown, path: string, issues: Issues): Item | null {
  if (!isRecord(raw)) {
    issues.push(`${path} はオブジェクトである必要があります`);
    return null;
  }

  const base = {
    id: readId(raw, "id", path, issues),
    x: readNumber(raw, "x", path, issues),
    y: readNumber(raw, "y", path, issues),
    width: readNumber(raw, "width", path, issues, 0),
    height: readNumber(raw, "height", path, issues, 0),
  };

  switch (raw["type"]) {
    case "sticky":
      return {
        ...base,
        ...readTextSettings(raw, BOXED_TEXT_DEFAULTS, path, issues),
        type: "sticky",
        text: readString(raw, "text", path, issues),
        color: readEnum<StickyColor>(
          raw,
          "color",
          STICKY_COLORS,
          "yellow",
          path,
          issues,
        ),
      };
    case "shape":
      return {
        ...base,
        ...readTextSettings(raw, BOXED_TEXT_DEFAULTS, path, issues),
        ...readStroke(raw, DEFAULT_STROKE, path, issues),
        fill: readFill(raw, path, issues),
        type: "shape",
        shape: readEnum<ShapeKind>(
          raw,
          "shape",
          SHAPE_KINDS,
          "rectangle",
          path,
          issues,
        ),
        text: readString(raw, "text", path, issues),
      };
    case "text":
      return {
        ...base,
        ...readTextSettings(raw, STANDALONE_TEXT_DEFAULTS, path, issues),
        type: "text",
        text: readString(raw, "text", path, issues),
      };
    case "image":
      return {
        ...base,
        type: "image",
        source: readString(raw, "source", path, issues),
        naturalWidth: readNumber(raw, "naturalWidth", path, issues, 1),
        naturalHeight: readNumber(raw, "naturalHeight", path, issues, 1),
      };
    default:
      issues.push(`${path}.type が未知の種類です: ${describe(raw["type"])}`);
      return null;
  }
}

/** 1 件のコネクタを検証する。復元できない場合は null を返す。 */
function parseConnector(
  raw: unknown,
  path: string,
  issues: Issues,
): Connector | null {
  if (!isRecord(raw)) {
    issues.push(`${path} はオブジェクトである必要があります`);
    return null;
  }
  return {
    ...readStroke(raw, DEFAULT_CONNECTOR_STROKE, path, issues),
    id: readId(raw, "id", path, issues),
    kind: readEnum<ConnectorKind>(
      raw,
      "kind",
      CONNECTOR_KINDS,
      "straight",
      path,
      issues,
    ),
    fromItemId: readId(raw, "fromItemId", path, issues),
    toItemId: readId(raw, "toItemId", path, issues),
    // 以前は矢印の有無だけを真偽値で持っていた。古いファイルはその値を
    // 「矢印」の印として読む。
    startCap: readCap(raw, "startCap", ["arrowStart"], path, issues),
    endCap: readCap(raw, "endCap", ["arrowEnd", "arrow"], path, issues),
    capSize:
      raw["capSize"] === undefined
        ? "medium"
        : readEnum<CapSize>(raw, "capSize", CAP_SIZES, "medium", path, issues),
    // 折れ線の中間の線の位置は後から加わった項目。無ければ真ん中とする。
    // 範囲外の値は経路が潰れないよう有効な範囲に丸める。
    bend:
      raw["bend"] === undefined
        ? DEFAULT_BEND
        : clampBend(readNumber(raw, "bend", path, issues)),
  };
}

/**
 * 端の印を読み出す。
 *
 * 以前は矢印の有無を真偽値で持っていた。現行の項目が無ければ、
 * 古い項目を「矢印」の印として読み替える。
 * @param legacyKeys 古い形式の項目名。先に見つかったものを使う
 */
function readCap(
  source: Record<string, unknown>,
  key: string,
  legacyKeys: readonly string[],
  path: string,
  issues: Issues,
): EndCap {
  if (source[key] !== undefined) {
    return readEnum<EndCap>(source, key, END_CAPS, "none", path, issues);
  }
  for (const legacy of legacyKeys) {
    const value = source[legacy];
    if (value === undefined) {
      continue;
    }
    if (typeof value !== "boolean") {
      issues.push(`${path}.${legacy} は真偽値である必要があります`);
      return "none";
    }
    return value ? "arrow" : "none";
  }
  return "none";
}

/** 配列を読み出す。配列でない場合は問題を記録して空配列を返す。 */
function readArray(
  source: Record<string, unknown>,
  key: string,
  path: string,
  issues: Issues,
): unknown[] {
  const value = source[key];
  if (!Array.isArray(value)) {
    issues.push(`${path}.${key} は配列である必要があります`);
    return [];
  }
  return value;
}

/** id の重複を検出する。 */
function collectDuplicateIds(
  entries: readonly { readonly id: string }[],
  path: string,
  field: string,
  issues: Issues,
): void {
  const seen = new Set<string>();
  entries.forEach((entry, index) => {
    if (entry.id !== "" && seen.has(entry.id)) {
      issues.push(`${path}[${index}].${field} が重複しています: ${describe(entry.id)}`);
    }
    seen.add(entry.id);
  });
}

/** ボードを保存用の JSON 文字列に変換する。 */
export function serializeBoard(board: Board): string {
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, board }, null, 2);
}

/**
 * 保存ファイルの JSON 文字列を検証して `Board` に復元する。
 *
 * @throws {BoardFileError} ファイルが読めない、または内容が不正な場合。
 */
export function parseBoardFile(text: string): Board {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BoardFileError(
      "ファイルを JSON として解析できませんでした。ファイルが破損している可能性があります。",
    );
  }

  if (!isRecord(raw)) {
    throw new BoardFileError(
      "ファイルの形式が MatoMemo のボードではありません。",
    );
  }

  const version = raw["schemaVersion"];
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new BoardFileError(
      "ファイルの schemaVersion が不正です。MatoMemo のボードファイルではない可能性があります。",
    );
  }
  if (version > SCHEMA_VERSION) {
    throw new BoardFileError(
      `このファイルはより新しいバージョンの MatoMemo (schemaVersion ${version}) で保存されています。アプリを更新してください。`,
    );
  }

  const rawBoard = raw["board"];
  if (!isRecord(rawBoard)) {
    throw new BoardFileError("ファイルに board が含まれていません。");
  }

  const issues: Issues = [];
  const id = readId(rawBoard, "id", "board", issues);
  const name = readString(rawBoard, "name", "board", issues);

  const rawItems = readArray(rawBoard, "items", "board", issues);
  const items: Item[] = [];
  let itemsAreValid = true;
  rawItems.forEach((rawItem, index) => {
    const item = parseItem(rawItem, `board.items[${index}]`, issues);
    if (item === null) {
      itemsAreValid = false;
      return;
    }
    items.push(item);
  });
  collectDuplicateIds(items, "board.items", "id", issues);

  const rawConnectors = readArray(rawBoard, "connectors", "board", issues);
  const connectors: Connector[] = [];
  rawConnectors.forEach((rawConnector, index) => {
    const path = `board.connectors[${index}]`;
    const connector = parseConnector(rawConnector, path, issues);
    if (connector === null) {
      return;
    }
    connectors.push(connector);

    // アイテム側に問題があると参照検査が無意味な報告を量産するため、
    // アイテムがすべて健全な場合にのみ参照の整合性を確かめる。
    if (!itemsAreValid) {
      return;
    }
    const knownIds = new Set(items.map((item) => item.id));
    for (const field of ["fromItemId", "toItemId"] as const) {
      const target = connector[field];
      if (target !== "" && !knownIds.has(target)) {
        issues.push(
          `${path}.${field} が存在しないアイテムを参照しています: ${describe(target)}`,
        );
      }
    }
  });
  collectDuplicateIds(connectors, "board.connectors", "id", issues);

  if (issues.length > 0) {
    throw new BoardFileError(
      `ボードファイルが破損しています (${issues.length} 件の問題)。`,
      issues,
    );
  }

  return { id, name, items, connectors };
}
