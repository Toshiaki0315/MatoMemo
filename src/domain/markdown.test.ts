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
import { addConnector, addItem } from "./boardOps";
import { boardToMarkdown, itemLabel } from "./markdown";

/** 付箋を id とテキストで作る。 */
function sticky(id: string, text: string) {
  return createStickyNote({ id, x: 0, y: 0, text });
}

/** アイテムとコネクタからボードを組み立てる。 */
function buildBoard(
  items: readonly { id: string; text: string }[],
  links: readonly [string, string][] = [],
  name = "設計メモ",
): Board {
  let board = createBoard({ id: "b", name });
  for (const item of items) {
    board = addItem(board, sticky(item.id, item.text));
  }
  links.forEach(([from, to], index) => {
    board = addConnector(
      board,
      createConnector({ id: `c${index}`, fromItemId: from, toItemId: to }),
    );
  });
  return board;
}

describe("itemLabel", () => {
  it("テキストをそのまま使う", () => {
    expect(itemLabel(sticky("a", "要件整理"))).toBe("要件整理");
  });

  it("前後の空白を落とす", () => {
    expect(itemLabel(sticky("a", "  余白あり  "))).toBe("余白あり");
  });

  it("改行は 1 行に均す", () => {
    expect(itemLabel(sticky("a", "一行目\n二行目"))).toBe("一行目 二行目");
  });

  it("画像は種類を示す", () => {
    expect(
      itemLabel(
        createImage({
          id: "i",
          x: 0,
          y: 0,
          source: "data:image/png;base64,AA",
          naturalWidth: 10,
          naturalHeight: 10,
        }),
      ),
    ).toBe("（画像）");
  });

  it("空の付箋は空であることを示す", () => {
    expect(itemLabel(sticky("a", ""))).toBe("（空）");
  });

  it("空のテキストアイテムも空であることを示す", () => {
    expect(itemLabel(createText({ id: "t", x: 0, y: 0 }))).toBe("（空）");
  });

  it("空の矩形と円は種類を示す", () => {
    expect(
      itemLabel(createShape({ id: "r", shape: "rectangle", x: 0, y: 0 })),
    ).toBe("（矩形）");
    expect(
      itemLabel(createShape({ id: "c", shape: "circle", x: 0, y: 0 })),
    ).toBe("（円）");
  });

  it("角丸矩形と直線も種類を示す", () => {
    expect(
      itemLabel(createShape({ id: "r", shape: "rounded", x: 0, y: 0 })),
    ).toBe("（角丸矩形）");
    expect(itemLabel(createShape({ id: "l", shape: "line", x: 0, y: 0 }))).toBe(
      "（直線）",
    );
  });

  it("テキストがあれば図形でも種類は出さない", () => {
    expect(
      itemLabel(createShape({ id: "c", shape: "circle", x: 0, y: 0, text: "原因" })),
    ).toBe("原因");
  });
});

describe("boardToMarkdown", () => {
  it("ボード名を見出しにする", () => {
    expect(boardToMarkdown(createBoard({ id: "b", name: "会議メモ" }))).toBe(
      "# 会議メモ\n\n",
    );
  });

  it("繋がっていないアイテムを並べる", () => {
    const board = buildBoard([
      { id: "a", text: "первый" },
      { id: "b", text: "二番目" },
    ]);
    expect(boardToMarkdown(board)).toBe(
      "# 設計メモ\n\n- первый\n- 二番目\n",
    );
  });

  it("線の向きを入れ子にする", () => {
    const board = buildBoard(
      [
        { id: "a", text: "課題" },
        { id: "b", text: "原因" },
      ],
      [["a", "b"]],
    );
    expect(boardToMarkdown(board)).toBe("# 設計メモ\n\n- 課題\n  - 原因\n");
  });

  it("何段でも入れ子にする", () => {
    const board = buildBoard(
      [
        { id: "a", text: "1" },
        { id: "b", text: "2" },
        { id: "c", text: "3" },
      ],
      [
        ["a", "b"],
        ["b", "c"],
      ],
    );
    expect(boardToMarkdown(board)).toBe(
      "# 設計メモ\n\n- 1\n  - 2\n    - 3\n",
    );
  });

  it("枝分かれを並べる", () => {
    const board = buildBoard(
      [
        { id: "a", text: "親" },
        { id: "b", text: "子1" },
        { id: "c", text: "子2" },
      ],
      [
        ["a", "b"],
        ["a", "c"],
      ],
    );
    expect(boardToMarkdown(board)).toBe(
      "# 設計メモ\n\n- 親\n  - 子1\n  - 子2\n",
    );
  });

  it("線を引いた順に子を並べる", () => {
    const board = buildBoard(
      [
        { id: "a", text: "親" },
        { id: "b", text: "先" },
        { id: "c", text: "後" },
      ],
      [
        ["a", "c"],
        ["a", "b"],
      ],
    );
    expect(boardToMarkdown(board)).toBe(
      "# 設計メモ\n\n- 親\n  - 後\n  - 先\n",
    );
  });

  it("親を持たないアイテムを起点にする", () => {
    const board = buildBoard(
      [
        { id: "child", text: "子" },
        { id: "root", text: "親" },
      ],
      [["root", "child"]],
    );
    // 配置順では子が先だが、親から書き出す
    expect(boardToMarkdown(board)).toBe("# 設計メモ\n\n- 親\n  - 子\n");
  });
});

describe("boardToMarkdown: 木にならない繋がり", () => {
  it("複数の親を持つ場合は 2 回目を再掲にする", () => {
    const board = buildBoard(
      [
        { id: "a", text: "親1" },
        { id: "b", text: "親2" },
        { id: "shared", text: "共有" },
      ],
      [
        ["a", "shared"],
        ["b", "shared"],
      ],
    );
    expect(boardToMarkdown(board)).toBe(
      "# 設計メモ\n\n- 親1\n  - 共有\n- 親2\n  - 共有（再掲）\n",
    );
  });

  it("循環しても無限に繰り返さない", () => {
    const board = buildBoard(
      [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
      [
        ["a", "b"],
        ["b", "a"],
      ],
    );
    // 親を持たないアイテムが無いので先頭を起点にする
    expect(boardToMarkdown(board)).toBe(
      "# 設計メモ\n\n- A\n  - B\n    - A（再掲）\n",
    );
  });

  it("自分自身を指す線があっても止まる", () => {
    const board = buildBoard([{ id: "a", text: "A" }], [["a", "a"]]);
    expect(boardToMarkdown(board)).toBe("# 設計メモ\n\n- A\n  - A（再掲）\n");
  });

  it("どの起点からも辿れないアイテムも書き出す", () => {
    // a → b の木と、c ⇄ d の循環が別々にある
    const board = buildBoard(
      [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
        { id: "c", text: "C" },
        { id: "d", text: "D" },
      ],
      [
        ["a", "b"],
        ["c", "d"],
        ["d", "c"],
      ],
    );
    const markdown = boardToMarkdown(board);
    expect(markdown).toContain("- A\n  - B");
    expect(markdown).toContain("- C\n  - D");
  });

  it("接続先が失われた線は無視する", () => {
    let board = buildBoard([{ id: "a", text: "A" }]);
    board = addConnector(
      board,
      createConnector({ id: "c", fromItemId: "a", toItemId: "missing" }),
    );
    expect(boardToMarkdown(board)).toBe("# 設計メモ\n\n- A\n");
  });

  it("すべてのアイテムが必ず 1 度は書き出される", () => {
    const board = buildBoard(
      [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
        { id: "c", text: "C" },
      ],
      [
        ["a", "b"],
        ["b", "c"],
        ["c", "a"],
      ],
    );
    const markdown = boardToMarkdown(board);
    for (const label of ["A", "B", "C"]) {
      expect(markdown).toContain(`- ${label}\n`);
    }
  });
});
