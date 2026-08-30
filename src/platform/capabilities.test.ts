/**
 * Tauri の権限設定が、アプリが実際に呼ぶコマンドを網羅しているかを確かめる。
 *
 * 権限が足りないとビルドも型検査も通るのに実行時に失敗する。実際、
 * `writeTextFile` は `write_text_file` コマンドを呼ぶのに `write-file`
 * しか許可しておらず、保存が動かない不具合を出した。
 * JS の API 名とコマンド名が一致しないことがあるため、対応表を明示して固定する。
 *
 * ファイルは Node の fs ではなく Vite のインポートで読む。アプリ本体は
 * ブラウザ環境なので、テストのために Node の型を持ち込みたくないため。
 */

import { describe, expect, it } from "vitest";
import capability from "../../src-tauri/capabilities/default.json";
// パッケージの exports で公開されていないので、実ファイルを直接読む
import dialogPluginSource from "../../node_modules/@tauri-apps/plugin-dialog/dist-js/index.js?raw";
import fsPluginSource from "../../node_modules/@tauri-apps/plugin-fs/dist-js/index.js?raw";

/**
 * アプリが使う Tauri の API と、それに必要な権限。
 * 新しい API を使い始めたらここに足す。
 */
const REQUIRED_PERMISSIONS: readonly {
  readonly api: string;
  readonly command: string;
  readonly permission: string;
}[] = [
  {
    api: "dialog.open (ボード / 画像を開く)",
    command: "plugin:dialog|open",
    permission: "dialog:allow-open",
  },
  {
    api: "dialog.save (保存先を選ぶ)",
    command: "plugin:dialog|save",
    permission: "dialog:allow-save",
  },
  {
    api: "fs.readTextFile (ボードの読み込み)",
    command: "plugin:fs|read_text_file",
    permission: "fs:allow-read-text-file",
  },
  {
    api: "fs.writeTextFile (ボードの保存)",
    command: "plugin:fs|write_text_file",
    permission: "fs:allow-write-text-file",
  },
  {
    api: "fs.readFile (画像の取り込み)",
    command: "plugin:fs|read_file",
    permission: "fs:allow-read-file",
  },
  {
    api: "window.destroy (終了)",
    // コアのコマンドはプラグイン形式の名前を持たない
    command: "",
    permission: "core:window:allow-destroy",
  },
];

describe("Tauri の権限設定", () => {
  it.each(REQUIRED_PERMISSIONS)(
    "$api には $permission が要る",
    ({ permission }) => {
      expect(capability.permissions).toContain(permission);
    },
  );

  it("使っていない権限を残さない", () => {
    const required = new Set([
      "core:default",
      ...REQUIRED_PERMISSIONS.map((entry) => entry.permission),
    ]);
    const extra = capability.permissions.filter(
      (permission) => !required.has(permission),
    );
    expect(extra).toEqual([]);
  });
});

describe("JS の API が呼ぶコマンド名", () => {
  /** プラグインの JS 実装から、実際に invoke されるコマンド名を集める。 */
  function invokedCommands(source: string): Set<string> {
    return new Set(
      [...source.matchAll(/'(plugin:[a-z]+\|[a-z_]+)'/g)].map(
        (match) => match[1] as string,
      ),
    );
  }

  it("対応表に挙げたコマンドが実在する", () => {
    const commands = new Set([
      ...invokedCommands(fsPluginSource),
      ...invokedCommands(dialogPluginSource),
    ]);
    for (const entry of REQUIRED_PERMISSIONS) {
      if (entry.command === "") {
        continue;
      }
      expect(commands, `${entry.api} のコマンド名が変わっています`).toContain(
        entry.command,
      );
    }
  });
});
