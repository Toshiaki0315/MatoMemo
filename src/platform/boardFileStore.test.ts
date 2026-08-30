import { describe, expect, it } from "vitest";
import { createBoard, createStickyNote } from "../domain/board";
import { serializeBoard } from "../domain/serialize";
import {
  BOARD_FILE_FILTER,
  StorageError,
  suggestFileName,
} from "./boardFileStore";
import { createMemoryBoardFileStore } from "./memoryBoardFileStore";

/** 付箋を 1 枚だけ持つボード。 */
function sampleBoard() {
  return {
    ...createBoard({ id: "b1", name: "設計メモ" }),
    items: [createStickyNote({ id: "i1", x: 0, y: 0, text: "案" })],
  };
}

describe("suggestFileName", () => {
  it("ボード名に拡張子を付ける", () => {
    expect(suggestFileName("設計メモ")).toBe("設計メモ.matomemo");
  });

  it("ファイル名に使えない文字を置き換える", () => {
    expect(suggestFileName('a/b\\c:d*e?f"g<h>i|j')).toBe(
      "a-b-c-d-e-f-g-h-i-j.matomemo",
    );
  });

  it("空白のみの名前は既定名にする", () => {
    expect(suggestFileName("   ")).toBe("board.matomemo");
  });

  it("前後の空白を取り除く", () => {
    expect(suggestFileName("  メモ  ")).toBe("メモ.matomemo");
  });

  it("長すぎる名前を切り詰める", () => {
    const name = suggestFileName("あ".repeat(200));
    expect(name.length).toBeLessThanOrEqual(80 + ".matomemo".length);
    expect(name.endsWith(".matomemo")).toBe(true);
  });
});

describe("BOARD_FILE_FILTER", () => {
  it("matomemo 拡張子のフィルタを提供する", () => {
    expect(BOARD_FILE_FILTER.extensions).toEqual(["matomemo"]);
  });
});

describe("StorageError", () => {
  it("Error を継承し原因を保持する", () => {
    const cause = new Error("disk full");
    const error = new StorageError("保存できません", cause);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("StorageError");
    expect(error.cause).toBe(cause);
  });

  it("原因を省略できる", () => {
    expect(new StorageError("失敗").cause).toBeUndefined();
  });
});

describe("createMemoryBoardFileStore", () => {
  it("保存した内容を読み戻せる", async () => {
    const store = createMemoryBoardFileStore();
    const board = sampleBoard();
    await store.save("/tmp/a.matomemo", board);
    expect(await store.load("/tmp/a.matomemo")).toEqual(board);
  });

  it("存在しないファイルの読み込みは StorageError にする", async () => {
    const store = createMemoryBoardFileStore();
    await expect(store.load("/tmp/none.matomemo")).rejects.toBeInstanceOf(
      StorageError,
    );
  });

  it("初期ファイルを与えられる", async () => {
    const board = sampleBoard();
    const store = createMemoryBoardFileStore({
      files: { "/tmp/a.matomemo": serializeBoard(board) },
    });
    expect(await store.load("/tmp/a.matomemo")).toEqual(board);
  });

  it("open は openPath のファイルを読む", async () => {
    const board = sampleBoard();
    const store = createMemoryBoardFileStore({
      files: { "/tmp/a.matomemo": serializeBoard(board) },
      openPath: "/tmp/a.matomemo",
    });
    expect(await store.open()).toEqual({ path: "/tmp/a.matomemo", board });
  });

  it("open は openPath が null なら null を返す（キャンセル）", async () => {
    expect(await createMemoryBoardFileStore().open()).toBeNull();
  });

  it("saveAs は savePath に保存してパスを返す", async () => {
    const store = createMemoryBoardFileStore({ savePath: "/tmp/new.matomemo" });
    const board = sampleBoard();
    expect(await store.saveAs(board)).toBe("/tmp/new.matomemo");
    expect(await store.load("/tmp/new.matomemo")).toEqual(board);
  });

  it("saveAs は savePath が null なら保存せず null を返す（キャンセル）", async () => {
    const store = createMemoryBoardFileStore();
    expect(await store.saveAs(sampleBoard())).toBeNull();
    expect(store.files.size).toBe(0);
  });

  it("書き込んだ内容を files から確認できる", async () => {
    const store = createMemoryBoardFileStore();
    await store.save("/tmp/a.matomemo", sampleBoard());
    expect(store.files.get("/tmp/a.matomemo")).toContain('"schemaVersion": 1');
  });
});
