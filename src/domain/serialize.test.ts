import { describe, expect, it } from "vitest";
import {
  createBoard,
  createConnector,
  createImage,
  createShape,
  createStickyNote,
  createText,
  type Board,
} from "./board";
import {
  BoardFileError,
  SCHEMA_VERSION,
  parseBoardFile,
  serializeBoard,
} from "./serialize";

/** すべての種類のアイテムとコネクタを含むボードを組み立てる。 */
function buildFullBoard(): Board {
  const sticky = createStickyNote({
    id: "item-sticky",
    x: 10,
    y: 20,
    text: "付箋のテキスト",
    color: "green",
  });
  const shape = createShape({
    id: "item-shape",
    shape: "circle",
    x: 300,
    y: 40,
    text: "円",
  });
  const text = createText({
    id: "item-text",
    x: -50,
    y: 120,
    text: "見出し",
    fontFamily: "Hiragino Mincho ProN",
    fontSize: 32,
  });
  const image = createImage({
    id: "item-image",
    x: 0,
    y: 400,
    source: "data:image/png;base64,iVBORw0KGgo=",
    naturalWidth: 640,
    naturalHeight: 480,
  });
  return {
    ...createBoard({ id: "board-1", name: "設計メモ" }),
    items: [sticky, shape, text, image],
    connectors: [
      createConnector({
        id: "conn-1",
        fromItemId: "item-sticky",
        toItemId: "item-shape",
      }),
      createConnector({
        id: "conn-2",
        fromItemId: "item-shape",
        toItemId: "item-text",
        kind: "polyline",
      }),
    ],
  };
}

/** 正常なボードファイルの JSON を組み立て、一部を差し替える。 */
function boardFileJson(
  mutate: (file: Record<string, unknown>) => void = () => {},
): string {
  const file = JSON.parse(serializeBoard(buildFullBoard())) as Record<
    string,
    unknown
  >;
  mutate(file);
  return JSON.stringify(file);
}

/** ボード直下のフィールドを差し替えた JSON を作る。 */
function boardJson(mutate: (board: Record<string, unknown>) => void): string {
  return boardFileJson((file) => {
    mutate(file["board"] as Record<string, unknown>);
  });
}

/** parseBoardFile が投げた BoardFileError を取り出す。 */
function catchError(json: string): BoardFileError {
  try {
    parseBoardFile(json);
  } catch (error) {
    if (error instanceof BoardFileError) {
      return error;
    }
    throw error;
  }
  throw new Error("BoardFileError が投げられませんでした");
}

describe("serializeBoard", () => {
  it("スキーマバージョンを含む JSON を出力する", () => {
    const parsed = JSON.parse(serializeBoard(buildFullBoard())) as {
      schemaVersion: number;
    };
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("人が読める整形済み JSON を出力する", () => {
    expect(serializeBoard(buildFullBoard())).toContain("\n  ");
  });
});

describe("ラウンドトリップ", () => {
  it("すべての種類のアイテムとコネクタを完全に復元する", () => {
    const board = buildFullBoard();
    expect(parseBoardFile(serializeBoard(board))).toEqual(board);
  });

  it("空のボードを復元する", () => {
    const board = createBoard({ id: "empty" });
    expect(parseBoardFile(serializeBoard(board))).toEqual(board);
  });

  it("アイテムの並び順（重なり順）を保つ", () => {
    const board = buildFullBoard();
    const restored = parseBoardFile(serializeBoard(board));
    expect(restored.items.map((item) => item.id)).toEqual([
      "item-sticky",
      "item-shape",
      "item-text",
      "item-image",
    ]);
  });
});

describe("BoardFileError", () => {
  it("Error を継承し名前を持つ", () => {
    const error = new BoardFileError("失敗");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("BoardFileError");
    expect(error.issues).toEqual([]);
  });
});

describe("parseBoardFile: ファイル全体の検証", () => {
  it("JSON として壊れている場合はエラーにする", () => {
    expect(catchError("{ではない").message).toMatch(/JSON/);
  });

  it("トップレベルがオブジェクトでない場合はエラーにする", () => {
    expect(catchError("[]").message).toMatch(/形式/);
    expect(catchError("null").message).toMatch(/形式/);
  });

  it("schemaVersion が数値でない場合はエラーにする", () => {
    expect(
      catchError(boardFileJson((file) => (file["schemaVersion"] = "1"))).message,
    ).toMatch(/schemaVersion/);
  });

  it("schemaVersion が整数でない場合はエラーにする", () => {
    expect(
      catchError(boardFileJson((file) => (file["schemaVersion"] = 1.5))).message,
    ).toMatch(/schemaVersion/);
  });

  it("schemaVersion が 1 未満の場合はエラーにする", () => {
    expect(
      catchError(boardFileJson((file) => (file["schemaVersion"] = 0))).message,
    ).toMatch(/schemaVersion/);
  });

  it("未来のスキーマバージョンは読めないと伝える", () => {
    const error = catchError(
      boardFileJson((file) => (file["schemaVersion"] = SCHEMA_VERSION + 1)),
    );
    expect(error.message).toMatch(/新しいバージョン/);
  });

  it("board がオブジェクトでない場合はエラーにする", () => {
    expect(
      catchError(boardFileJson((file) => (file["board"] = 42))).message,
    ).toMatch(/board/);
  });
});

describe("parseBoardFile: ボード属性の検証", () => {
  it("id が文字列でない場合はエラーにする", () => {
    expect(catchError(boardJson((b) => (b["id"] = 1))).issues).toContain(
      "board.id は空でない文字列である必要があります",
    );
  });

  it("id が空文字の場合はエラーにする", () => {
    expect(catchError(boardJson((b) => (b["id"] = ""))).issues).toContain(
      "board.id は空でない文字列である必要があります",
    );
  });

  it("name が文字列でない場合はエラーにする", () => {
    expect(catchError(boardJson((b) => (b["name"] = null))).issues).toContain(
      "board.name は文字列である必要があります",
    );
  });

  it("items が配列でない場合はエラーにする", () => {
    expect(catchError(boardJson((b) => (b["items"] = {}))).issues).toContain(
      "board.items は配列である必要があります",
    );
  });

  it("connectors が配列でない場合はエラーにする", () => {
    expect(
      catchError(boardJson((b) => (b["connectors"] = "x"))).issues,
    ).toContain("board.connectors は配列である必要があります");
  });

  it("複数の問題をまとめて報告する", () => {
    const error = catchError(
      boardJson((b) => {
        b["id"] = 1;
        b["name"] = 2;
      }),
    );
    expect(error.issues).toHaveLength(2);
    expect(error.message).toMatch(/破損/);
  });
});

describe("parseBoardFile: アイテムの検証", () => {
  /** items[0] を差し替えた JSON を作る。 */
  function withItem(value: unknown): string {
    return boardJson((b) => {
      b["items"] = [value];
      b["connectors"] = [];
    });
  }

  /** items[0]（付箋）の 1 フィールドを差し替えた JSON を作る。 */
  function withStickyField(key: string, value: unknown): string {
    return boardJson((b) => {
      const items = b["items"] as Record<string, unknown>[];
      const sticky = { ...items[0], [key]: value };
      b["items"] = [sticky];
      b["connectors"] = [];
    });
  }

  it("アイテムがオブジェクトでない場合はエラーにする", () => {
    expect(catchError(withItem("文字列")).issues).toContain(
      "board.items[0] はオブジェクトである必要があります",
    );
  });

  it("未知の type はエラーにする", () => {
    expect(catchError(withStickyField("type", "hexagon")).issues).toContain(
      'board.items[0].type が未知の種類です: "hexagon"',
    );
  });

  it("type が欠けている場合もエラーにする", () => {
    const json = boardJson((b) => {
      const items = b["items"] as Record<string, unknown>[];
      const { type: _omitted, ...withoutType } = items[0] as Record<
        string,
        unknown
      >;
      b["items"] = [withoutType];
      b["connectors"] = [];
    });
    expect(catchError(json).issues).toContain(
      "board.items[0].type が未知の種類です: undefined",
    );
  });

  it("id が空の場合はエラーにする", () => {
    expect(catchError(withStickyField("id", "")).issues).toContain(
      "board.items[0].id は空でない文字列である必要があります",
    );
  });

  it("座標が数値でない場合はエラーにする", () => {
    expect(catchError(withStickyField("x", "10")).issues).toContain(
      "board.items[0].x は有限の数値である必要があります",
    );
  });

  it("座標が NaN や Infinity の場合はエラーにする", () => {
    expect(catchError(withStickyField("y", null)).issues).toContain(
      "board.items[0].y は有限の数値である必要があります",
    );
  });

  it("幅が負の場合はエラーにする", () => {
    expect(catchError(withStickyField("width", -1)).issues).toContain(
      "board.items[0].width は 0 以上である必要があります",
    );
  });

  it("付箋の text が文字列でない場合はエラーにする", () => {
    expect(catchError(withStickyField("text", 1)).issues).toContain(
      "board.items[0].text は文字列である必要があります",
    );
  });

  it("付箋の色がパレット外の場合はエラーにする", () => {
    expect(catchError(withStickyField("color", "crimson")).issues).toContain(
      'board.items[0].color が未知の値です: "crimson"',
    );
  });

  it("図形の shape が不正な場合はエラーにする", () => {
    expect(
      catchError(
        boardJson((b) => {
          b["items"] = [
            {
              id: "s",
              type: "shape",
              shape: "triangle",
              x: 0,
              y: 0,
              width: 10,
              height: 10,
              text: "",
            },
          ];
          b["connectors"] = [];
        }),
      ).issues,
    ).toContain('board.items[0].shape が未知の値です: "triangle"');
  });

  it("テキストの fontSize が 0 以下の場合はエラーにする", () => {
    expect(
      catchError(
        boardJson((b) => {
          b["items"] = [
            {
              id: "t",
              type: "text",
              x: 0,
              y: 0,
              width: 10,
              height: 10,
              text: "",
              fontFamily: "Hiragino Sans",
              fontSize: 0,
            },
          ];
          b["connectors"] = [];
        }),
      ).issues,
    ).toContain("board.items[0].fontSize は 1 以上である必要があります");
  });

  it("画像の naturalWidth が 0 の場合はエラーにする", () => {
    expect(
      catchError(
        boardJson((b) => {
          b["items"] = [
            {
              id: "img",
              type: "image",
              x: 0,
              y: 0,
              width: 10,
              height: 10,
              source: "data:image/png;base64,AA",
              naturalWidth: 0,
              naturalHeight: 10,
            },
          ];
          b["connectors"] = [];
        }),
      ).issues,
    ).toContain("board.items[0].naturalWidth は 1 以上である必要があります");
  });

  it("アイテム id の重複はエラーにする", () => {
    expect(
      catchError(
        boardJson((b) => {
          const items = b["items"] as Record<string, unknown>[];
          b["items"] = [items[0], { ...items[0] }];
          b["connectors"] = [];
        }),
      ).issues,
    ).toContain('board.items[1].id が重複しています: "item-sticky"');
  });
});

describe("parseBoardFile: コネクタの検証", () => {
  /** connectors[0] を差し替えた JSON を作る。 */
  function withConnector(value: unknown): string {
    return boardJson((b) => {
      b["connectors"] = [value];
    });
  }

  /** connectors[0] の 1 フィールドを差し替えた JSON を作る。 */
  function withConnectorField(key: string, value: unknown): string {
    return boardJson((b) => {
      const connectors = b["connectors"] as Record<string, unknown>[];
      b["connectors"] = [{ ...connectors[0], [key]: value }];
    });
  }

  it("コネクタがオブジェクトでない場合はエラーにする", () => {
    expect(catchError(withConnector(null)).issues).toContain(
      "board.connectors[0] はオブジェクトである必要があります",
    );
  });

  it("kind が不正な場合はエラーにする", () => {
    expect(catchError(withConnectorField("kind", "zigzag")).issues).toContain(
      'board.connectors[0].kind が未知の値です: "zigzag"',
    );
  });

  it("id が空の場合はエラーにする", () => {
    expect(catchError(withConnectorField("id", "")).issues).toContain(
      "board.connectors[0].id は空でない文字列である必要があります",
    );
  });

  it("存在しないアイテムを参照している場合はエラーにする", () => {
    expect(
      catchError(withConnectorField("fromItemId", "missing")).issues,
    ).toContain(
      'board.connectors[0].fromItemId が存在しないアイテムを参照しています: "missing"',
    );
  });

  it("接続先が存在しない場合もエラーにする", () => {
    expect(
      catchError(withConnectorField("toItemId", "missing")).issues,
    ).toContain(
      'board.connectors[0].toItemId が存在しないアイテムを参照しています: "missing"',
    );
  });

  it("コネクタ id の重複はエラーにする", () => {
    expect(
      catchError(
        boardJson((b) => {
          const connectors = b["connectors"] as Record<string, unknown>[];
          b["connectors"] = [connectors[0], { ...connectors[0] }];
        }),
      ).issues,
    ).toContain('board.connectors[1].id が重複しています: "conn-1"');
  });

  it("アイテムが不正なときは参照検査を行わない（重複した報告を避ける）", () => {
    const error = catchError(
      boardJson((b) => {
        b["items"] = ["壊れたアイテム"];
      }),
    );
    expect(error.issues).toEqual([
      "board.items[0] はオブジェクトである必要があります",
    ]);
  });
});

describe("parseBoardFile: 端の印", () => {
  /** connectors[0] のフィールドを差し替えた JSON を作る。 */
  function withFields(fields: Record<string, unknown>): string {
    return boardJson((b) => {
      const connectors = b["connectors"] as Record<string, unknown>[];
      const {
        startCap: _s,
        endCap: _e,
        capSize: _c,
        ...rest
      } = connectors[0] as Record<string, unknown>;
      b["connectors"] = [{ ...rest, ...fields }];
    });
  }

  it("両端の印と大きさを復元する", () => {
    expect(
      parseBoardFile(
        withFields({ startCap: "arrow", endCap: "circle", capSize: "large" }),
      ).connectors[0],
    ).toMatchObject({
      startCap: "arrow",
      endCap: "circle",
      capSize: "large",
    });
  });

  it("項目が無い古いファイルは印なし・中くらいとして読む", () => {
    expect(parseBoardFile(withFields({})).connectors[0]).toMatchObject({
      startCap: "none",
      endCap: "none",
      capSize: "medium",
    });
  });

  it("以前の arrowStart / arrowEnd を矢印として読む", () => {
    expect(
      parseBoardFile(withFields({ arrowStart: true, arrowEnd: false }))
        .connectors[0],
    ).toMatchObject({ startCap: "arrow", endCap: "none" });
  });

  it("さらに古い arrow は終点の矢印として読む", () => {
    expect(parseBoardFile(withFields({ arrow: true })).connectors[0]).toMatchObject(
      { startCap: "none", endCap: "arrow" },
    );
  });

  it("arrowEnd があれば arrow より優先する", () => {
    expect(
      parseBoardFile(withFields({ arrow: true, arrowEnd: false })).connectors[0],
    ).toMatchObject({ endCap: "none" });
  });

  it("現行の項目があれば古い項目より優先する", () => {
    expect(
      parseBoardFile(withFields({ endCap: "circle", arrowEnd: true }))
        .connectors[0],
    ).toMatchObject({ endCap: "circle" });
  });

  it("未知の印はエラーにする", () => {
    expect(catchError(withFields({ startCap: "square" })).issues).toContain(
      'board.connectors[0].startCap が未知の値です: "square"',
    );
  });

  it("未知の大きさはエラーにする", () => {
    expect(catchError(withFields({ capSize: "huge" })).issues).toContain(
      'board.connectors[0].capSize が未知の値です: "huge"',
    );
  });

  it("古い項目が真偽値でない場合はエラーにする", () => {
    expect(catchError(withFields({ arrowStart: "yes" })).issues).toContain(
      "board.connectors[0].arrowStart は真偽値である必要があります",
    );
  });
});

describe("parseBoardFile: 線の見た目", () => {
  /** items[0]（付箋）を図形に差し替えた JSON を作る。 */
  function withShape(fields: Record<string, unknown>): string {
    return boardJson((b) => {
      const items = b["items"] as Record<string, unknown>[];
      b["items"] = [{ ...items[1], ...fields }];
      b["connectors"] = [];
    });
  }

  /** connectors[0] のフィールドを差し替えた JSON を作る。 */
  function withConnector(fields: Record<string, unknown>): string {
    return boardJson((b) => {
      const connectors = b["connectors"] as Record<string, unknown>[];
      const {
        strokeWidth: _w,
        strokeStyle: _s,
        ...rest
      } = connectors[0] as Record<string, unknown>;
      b["connectors"] = [{ ...rest, ...fields }];
    });
  }

  it("図形の太さと線種を復元する", () => {
    expect(
      parseBoardFile(withShape({ strokeWidth: 5, strokeStyle: "dashed" }))
        .items[0],
    ).toMatchObject({ strokeWidth: 5, strokeStyle: "dashed" });
  });

  it("項目が無い古いファイルは細い実線として読む", () => {
    const json = boardJson((b) => {
      const items = b["items"] as Record<string, unknown>[];
      const {
        strokeWidth: _w,
        strokeStyle: _s,
        fill: _f,
        ...rest
      } = items[1] as Record<string, unknown>;
      b["items"] = [rest];
      b["connectors"] = [];
    });
    expect(parseBoardFile(json).items[0]).toMatchObject({
      strokeWidth: 1,
      strokeStyle: "solid",
    });
  });

  it("コネクタの太さと線種を復元する", () => {
    expect(
      parseBoardFile(withConnector({ strokeWidth: 3, strokeStyle: "dotted" }))
        .connectors[0],
    ).toMatchObject({ strokeWidth: 3, strokeStyle: "dotted" });
  });

  it("項目が無い古いコネクタは既定の太さで読む", () => {
    expect(parseBoardFile(withConnector({})).connectors[0]).toMatchObject({
      strokeWidth: 2,
      strokeStyle: "solid",
    });
  });

  it("未知の線種はエラーにする", () => {
    expect(catchError(withShape({ strokeStyle: "wavy" })).issues).toContain(
      'board.items[0].strokeStyle が未知の値です: "wavy"',
    );
  });

  it("太さが 1 未満ならエラーにする", () => {
    expect(catchError(withShape({ strokeWidth: 0 })).issues).toContain(
      "board.items[0].strokeWidth は 1 以上である必要があります",
    );
  });
});

describe("parseBoardFile: 図形の塗り", () => {
  function withShape(fields: Record<string, unknown>): string {
    return boardJson((b) => {
      const items = b["items"] as Record<string, unknown>[];
      b["items"] = [{ ...items[1], ...fields }];
      b["connectors"] = [];
    });
  }

  it("塗りの色を復元する", () => {
    expect(parseBoardFile(withShape({ fill: "#FF0000" })).items[0]).toMatchObject(
      { fill: "#FF0000" },
    );
  });

  it("null は塗らないとして読む", () => {
    expect(parseBoardFile(withShape({ fill: null })).items[0]).toMatchObject({
      fill: null,
    });
  });

  it("項目が無い古いファイルは白で塗る", () => {
    const json = boardJson((b) => {
      const items = b["items"] as Record<string, unknown>[];
      const { fill: _f, ...rest } = items[1] as Record<string, unknown>;
      b["items"] = [rest];
      b["connectors"] = [];
    });
    expect(parseBoardFile(json).items[0]).toMatchObject({ fill: "#FFFFFF" });
  });

  it("色でも null でもなければエラーにする", () => {
    expect(catchError(withShape({ fill: 123 })).issues).toContain(
      "board.items[0].fill は色の文字列か null である必要があります",
    );
  });
});

describe("parseBoardFile: テキストの配置", () => {
  /** items[0]（付箋）の配置を差し替えた JSON を作る。 */
  function withAlignment(fields: Record<string, unknown>): string {
    return boardJson((b) => {
      const items = b["items"] as Record<string, unknown>[];
      b["items"] = [{ ...items[0], ...fields }];
      b["connectors"] = [];
    });
  }

  it("配置を復元する", () => {
    const board = parseBoardFile(
      withAlignment({ align: "right", verticalAlign: "bottom" }),
    );
    expect(board.items[0]).toMatchObject({
      align: "right",
      verticalAlign: "bottom",
    });
  });

  it("項目が無い古いファイルは種類ごとの既定値で読む", () => {
    const json = boardJson((b) => {
      const items = b["items"] as Record<string, unknown>[];
      b["items"] = items.map((item) => {
        const {
          align: _a,
          verticalAlign: _v,
          ...rest
        } = item as Record<string, unknown>;
        return rest;
      });
      b["connectors"] = [];
    });
    const board = parseBoardFile(json);
    // 付箋は中央寄せ
    expect(board.items[0]).toMatchObject({
      align: "center",
      verticalAlign: "middle",
    });
    // 単体テキストは左上寄せ
    expect(board.items[2]).toMatchObject({
      align: "left",
      verticalAlign: "top",
    });
  });

  it("未知の値はエラーにする", () => {
    expect(catchError(withAlignment({ align: "justify" })).issues).toContain(
      'board.items[0].align が未知の値です: "justify"',
    );
    expect(
      catchError(withAlignment({ verticalAlign: "baseline" })).issues,
    ).toContain('board.items[0].verticalAlign が未知の値です: "baseline"');
  });
});
