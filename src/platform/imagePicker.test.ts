import { beforeEach, describe, expect, it, vi } from "vitest";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { StorageError } from "./boardFileStore";
import { pickImage } from "./imagePicker";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

const openDialogMock = vi.mocked(openDialog);
const readFileMock = vi.mocked(readFile);

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("pickImage", () => {
  it("選ばれた画像を取り込む", async () => {
    openDialogMock.mockResolvedValue("/tmp/a.png");
    readFileMock.mockResolvedValue(PNG_BYTES);
    const result = await pickImage({
      measure: async () => ({ width: 20, height: 10 }),
    });
    expect(result).toMatchObject({ naturalWidth: 20, naturalHeight: 10 });
  });

  it("対応拡張子で絞り込む", async () => {
    openDialogMock.mockResolvedValue(null);
    await pickImage();
    expect(openDialogMock).toHaveBeenCalledWith({
      multiple: false,
      directory: false,
      filters: [{ name: "画像", extensions: ["png", "jpg", "jpeg", "bmp"] }],
    });
  });

  it("キャンセルされたら null を返す", async () => {
    openDialogMock.mockResolvedValue(null);
    expect(await pickImage()).toBeNull();
  });

  it("ダイアログが失敗したら StorageError にする", async () => {
    openDialogMock.mockRejectedValue(new Error("failed"));
    await expect(pickImage()).rejects.toThrow(StorageError);
  });

  it("読み込みが失敗したら StorageError にする", async () => {
    openDialogMock.mockResolvedValue("/tmp/a.png");
    readFileMock.mockRejectedValue(new Error("EACCES"));
    await expect(pickImage()).rejects.toThrow(StorageError);
  });
});
