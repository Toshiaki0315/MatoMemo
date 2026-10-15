import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  isNativeEditAction,
  listenMenuActions,
  performNativeEdit,
} from "./appMenu";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);
const listenMock = vi.mocked(listen);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listenMenuActions", () => {
  /** listen に渡された処理へ、届いたことにするイベントを流す。 */
  async function subscribe() {
    const unlisten = vi.fn();
    listenMock.mockResolvedValue(unlisten);
    const onAction = vi.fn();
    const stop = await listenMenuActions(onAction);
    const handler = listenMock.mock.calls[0]?.[1] as (event: {
      payload: string;
    }) => void;
    return { onAction, stop, unlisten, handler };
  }

  it("menu-action イベントを購読する", async () => {
    const { stop, unlisten } = await subscribe();
    expect(listenMock).toHaveBeenCalledWith("menu-action", expect.any(Function));
    stop();
    expect(unlisten).toHaveBeenCalled();
  });

  it("届いた項目の id を知らせる", async () => {
    const { onAction, handler } = await subscribe();
    handler({ payload: "exportSvg" });
    expect(onAction).toHaveBeenCalledWith("exportSvg");
  });

  it("知らない id は無視する", async () => {
    const { onAction, handler } = await subscribe();
    handler({ payload: "somethingNew" });
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe("performNativeEdit", () => {
  it("入力欄の標準の操作を Rust 側に頼む", () => {
    invokeMock.mockResolvedValue(undefined);
    performNativeEdit("paste");
    expect(invokeMock).toHaveBeenCalledWith("perform_native_edit", {
      action: "paste",
    });
  });

  it("頼めなくても例外にしない", () => {
    invokeMock.mockRejectedValue(new Error("not available"));
    expect(() => performNativeEdit("copy")).not.toThrow();
  });

  it("Tauri の外で同期的に失敗しても例外にしない", () => {
    invokeMock.mockImplementation(() => {
      throw new Error("__TAURI_INTERNALS__ is undefined");
    });
    expect(() => performNativeEdit("undo")).not.toThrow();
  });
});

describe("isNativeEditAction", () => {
  it("文字の編集にある操作だけを入力欄の操作とする", () => {
    expect(isNativeEditAction("copy")).toBe(true);
    expect(isNativeEditAction("selectAll")).toBe(true);
    // 複製は文字の編集には無い
    expect(isNativeEditAction("duplicate")).toBe(false);
    expect(isNativeEditAction("exportSvg")).toBe(false);
  });
});
