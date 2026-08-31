import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { setPanKeyHeld } from "./cursor";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("setPanKeyHeld", () => {
  it("パンの開始を知らせるコマンドを呼ぶ", () => {
    invokeMock.mockResolvedValue(undefined);
    setPanKeyHeld(true);
    expect(invokeMock).toHaveBeenCalledWith("set_pan_key_held", { held: true });
  });

  it("パンの終了も知らせる", () => {
    invokeMock.mockResolvedValue(undefined);
    setPanKeyHeld(false);
    expect(invokeMock).toHaveBeenCalledWith("set_pan_key_held", {
      held: false,
    });
  });

  it("コマンドが失敗しても例外にしない", () => {
    invokeMock.mockRejectedValue(new Error("not available"));
    expect(() => setPanKeyHeld(true)).not.toThrow();
  });

  it("Tauri の外で同期的に失敗しても例外にしない", () => {
    invokeMock.mockImplementation(() => {
      throw new Error("__TAURI_INTERNALS__ is undefined");
    });
    expect(() => setPanKeyHeld(true)).not.toThrow();
  });
});
