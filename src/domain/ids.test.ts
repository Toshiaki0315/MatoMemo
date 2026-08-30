import { describe, expect, it } from "vitest";
import { createId } from "./ids";

describe("createId", () => {
  it("UUID 形式の文字列を返す", () => {
    expect(createId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("呼ぶたびに異なる id を返す", () => {
    const ids = new Set(Array.from({ length: 100 }, () => createId()));
    expect(ids.size).toBe(100);
  });
});
