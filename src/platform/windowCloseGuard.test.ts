import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { closeWindow, guardWindowClose } from "./windowCloseGuard";

const onCloseRequested = vi.fn();
const destroy = vi.fn();

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({ onCloseRequested, destroy })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

/** onCloseRequested に渡されたハンドラを取り出す。 */
function registeredHandler(): (event: { preventDefault: () => void }) => Promise<void> {
  return onCloseRequested.mock.calls[0]?.[0] as never;
}

describe("guardWindowClose", () => {
  it("閉じる要求を購読する", async () => {
    onCloseRequested.mockResolvedValue(vi.fn());
    await guardWindowClose(() => true);
    expect(getCurrentWindow).toHaveBeenCalled();
    expect(onCloseRequested).toHaveBeenCalled();
  });

  it("閉じてよければ既定の動作を妨げない", async () => {
    onCloseRequested.mockResolvedValue(vi.fn());
    await guardWindowClose(() => true);

    const preventDefault = vi.fn();
    await registeredHandler()({ preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("閉じてはいけない場合は既定の動作を止める", async () => {
    onCloseRequested.mockResolvedValue(vi.fn());
    await guardWindowClose(() => false);

    const preventDefault = vi.fn();
    await registeredHandler()({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();
  });

  it("非同期の判定も待つ", async () => {
    onCloseRequested.mockResolvedValue(vi.fn());
    await guardWindowClose(async () => false);

    const preventDefault = vi.fn();
    await registeredHandler()({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();
  });

  it("購読の解除関数を返す", async () => {
    const unlisten = vi.fn();
    onCloseRequested.mockResolvedValue(unlisten);
    const stop = await guardWindowClose(() => true);
    stop();
    expect(unlisten).toHaveBeenCalled();
  });
});

describe("closeWindow", () => {
  it("ウィンドウを破棄する", async () => {
    destroy.mockResolvedValue(undefined);
    await closeWindow();
    expect(destroy).toHaveBeenCalled();
  });
});
