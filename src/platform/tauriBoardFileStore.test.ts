import { beforeEach, describe, expect, it, vi } from "vitest";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { createBoard, createStickyNote } from "../domain/board";
import { serializeBoard } from "../domain/serialize";
import { StorageError } from "./boardFileStore";
import { createTauriBoardFileStore } from "./tauriBoardFileStore";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

const openDialogMock = vi.mocked(openDialog);
const saveDialogMock = vi.mocked(saveDialog);
const readTextFileMock = vi.mocked(readTextFile);
const writeTextFileMock = vi.mocked(writeTextFile);

function sampleBoard() {
  return {
    ...createBoard({ id: "b1", name: "設計メモ" }),
    items: [createStickyNote({ id: "i1", x: 0, y: 0, text: "案" })],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createTauriBoardFileStore: load", () => {
  it("ファイルを読み込んで復元する", async () => {
    const board = sampleBoard();
    readTextFileMock.mockResolvedValue(serializeBoard(board));
    expect(await createTauriBoardFileStore().load("/tmp/a.matomemo")).toEqual(
      board,
    );
    expect(readTextFileMock).toHaveBeenCalledWith("/tmp/a.matomemo");
  });

  it("読み込みに失敗したら StorageError にする", async () => {
    readTextFileMock.mockRejectedValue(new Error("EACCES"));
    await expect(
      createTauriBoardFileStore().load("/tmp/a.matomemo"),
    ).rejects.toThrow(StorageError);
  });

  it("内容が不正なら BoardFileError をそのまま伝える", async () => {
    readTextFileMock.mockResolvedValue("壊れています");
    await expect(
      createTauriBoardFileStore().load("/tmp/a.matomemo"),
    ).rejects.toThrow(/JSON/);
  });
});

describe("createTauriBoardFileStore: save", () => {
  it("シリアライズしてファイルに書き込む", async () => {
    writeTextFileMock.mockResolvedValue(undefined);
    const board = sampleBoard();
    await createTauriBoardFileStore().save("/tmp/a.matomemo", board);
    expect(writeTextFileMock).toHaveBeenCalledWith(
      "/tmp/a.matomemo",
      serializeBoard(board),
    );
  });

  it("書き込みに失敗したら StorageError にする", async () => {
    writeTextFileMock.mockRejectedValue(new Error("ENOSPC"));
    await expect(
      createTauriBoardFileStore().save("/tmp/a.matomemo", sampleBoard()),
    ).rejects.toThrow(StorageError);
  });
});

describe("createTauriBoardFileStore: open", () => {
  it("ダイアログで選ばれたファイルを読み込む", async () => {
    const board = sampleBoard();
    openDialogMock.mockResolvedValue("/tmp/a.matomemo");
    readTextFileMock.mockResolvedValue(serializeBoard(board));
    expect(await createTauriBoardFileStore().open()).toEqual({
      path: "/tmp/a.matomemo",
      board,
    });
  });

  it("matomemo 拡張子で絞り込む", async () => {
    openDialogMock.mockResolvedValue(null);
    await createTauriBoardFileStore().open();
    expect(openDialogMock).toHaveBeenCalledWith({
      multiple: false,
      directory: false,
      filters: [{ name: "MatoMemo ボード", extensions: ["matomemo"] }],
    });
  });

  it("キャンセルされたら null を返す", async () => {
    openDialogMock.mockResolvedValue(null);
    expect(await createTauriBoardFileStore().open()).toBeNull();
  });

  it("ダイアログが失敗したら StorageError にする", async () => {
    openDialogMock.mockRejectedValue(new Error("dialog failed"));
    await expect(createTauriBoardFileStore().open()).rejects.toThrow(
      StorageError,
    );
  });
});

describe("createTauriBoardFileStore: saveAs", () => {
  it("ダイアログで選ばれたパスに保存してパスを返す", async () => {
    saveDialogMock.mockResolvedValue("/tmp/new.matomemo");
    writeTextFileMock.mockResolvedValue(undefined);
    const board = sampleBoard();
    expect(await createTauriBoardFileStore().saveAs(board)).toBe(
      "/tmp/new.matomemo",
    );
    expect(writeTextFileMock).toHaveBeenCalledWith(
      "/tmp/new.matomemo",
      serializeBoard(board),
    );
  });

  it("ボード名を既定のファイル名として提案する", async () => {
    saveDialogMock.mockResolvedValue(null);
    await createTauriBoardFileStore().saveAs(sampleBoard());
    expect(saveDialogMock).toHaveBeenCalledWith({
      defaultPath: "設計メモ.matomemo",
      filters: [{ name: "MatoMemo ボード", extensions: ["matomemo"] }],
    });
  });

  it("キャンセルされたら保存せず null を返す", async () => {
    saveDialogMock.mockResolvedValue(null);
    expect(await createTauriBoardFileStore().saveAs(sampleBoard())).toBeNull();
    expect(writeTextFileMock).not.toHaveBeenCalled();
  });

  it("ダイアログが失敗したら StorageError にする", async () => {
    saveDialogMock.mockRejectedValue(new Error("dialog failed"));
    await expect(
      createTauriBoardFileStore().saveAs(sampleBoard()),
    ).rejects.toThrow(StorageError);
  });
});
