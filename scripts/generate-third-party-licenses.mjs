#!/usr/bin/env node
/**
 * THIRD_PARTY_LICENSES.md を生成する。
 *
 * 配布物（.app バンドル）に含まれる依存のみを対象とする。
 *   - Rust: cargo metadata の解決グラフを normal 依存だけ辿る（build / dev 依存は除外）
 *   - npm : package-lock.json のうち dev でないパッケージ（バンドルされるもの）
 *
 * 実行前に `npm install` と `cargo fetch` が完了している必要がある
 * （ライセンス全文と著作権表示をローカルのパッケージから読み取るため）。
 *
 * 使い方: npm run licenses
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** LICENSE ファイル名らしきものを探すパターン。 */
const LICENSE_FILE_RE = /^(licen[cs]e|copying|notice)([-_.].*)?$/i;

/**
 * ライセンス本文中の定型句を著作権表示と誤認しないためのパターン。
 * Apache-2.0 の定義節・付録テンプレートや MPL-2.0 の本文が該当する。
 */
const BOILERPLATE_RE =
  /\[yyyy\]|\[name of copyright owner\]|<year>|<name of author>|"Licensor"|doctrines of fair use/i;

/** ライセンスファイルの読み取り優先順位。実際の著作権者が書かれている可能性が高い順。 */
function licenseFilePriority(name) {
  const lower = name.toLowerCase();
  if (lower.startsWith("notice")) return 0;
  if (/mit/.test(lower)) return 1;
  if (/bsd|isc|zlib/.test(lower)) return 2;
  if (lower === "license" || lower === "licence" || lower === "copying") return 3;
  if (/apache/.test(lower)) return 5; // Apache 全文は定型句だらけなので最後に見る
  return 4;
}

/** ディレクトリ内のライセンスファイルから著作権表示行を抜き出す。 */
function findCopyright(dir) {
  if (!dir || !existsSync(dir)) {
    return null;
  }
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  const candidates = entries
    .filter((e) => e.isFile() && LICENSE_FILE_RE.test(e.name))
    .sort((a, b) => licenseFilePriority(a.name) - licenseFilePriority(b.name));

  for (const entry of candidates) {
    let text;
    try {
      text = readFileSync(join(dir, entry.name), "utf8");
    } catch {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      // 行頭が Copyright で始まるものだけを著作権表示とみなす
      if (!/^copyright\b/i.test(trimmed) || BOILERPLATE_RE.test(trimmed)) {
        continue;
      }
      return trimmed.replace(/\s+/g, " ").slice(0, 120);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rust
// ---------------------------------------------------------------------------

function collectRustPackages() {
  const raw = execFileSync(
    "cargo",
    [
      "metadata",
      "--format-version",
      "1",
      "--filter-platform",
      "aarch64-apple-darwin",
    ],
    { cwd: join(ROOT, "src-tauri"), maxBuffer: 64 * 1024 * 1024 },
  );
  const meta = JSON.parse(raw);
  const byId = new Map(meta.packages.map((p) => [p.id, p]));
  const nodes = new Map(meta.resolve.nodes.map((n) => [n.id, n]));
  const rootId = meta.resolve.root;

  // ルートから normal 依存のみを辿る（build / dev 依存はバンドルされない）
  const reachable = new Set();
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.pop();
    if (reachable.has(id)) {
      continue;
    }
    reachable.add(id);
    const node = nodes.get(id);
    if (!node) {
      continue;
    }
    for (const dep of node.deps) {
      const isNormal = dep.dep_kinds.some((k) => k.kind === null);
      if (isNormal && !reachable.has(dep.pkg)) {
        queue.push(dep.pkg);
      }
    }
  }
  reachable.delete(rootId);

  return [...reachable]
    .map((id) => {
      const pkg = byId.get(id);
      return {
        name: pkg.name,
        version: pkg.version,
        license: pkg.license ?? "(未宣言)",
        repository: pkg.repository ?? "",
        copyright: findCopyright(pkg.manifest_path ? dirname(pkg.manifest_path) : null),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// npm
// ---------------------------------------------------------------------------

function collectNpmPackages() {
  const lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8"));
  const results = [];

  for (const [path, entry] of Object.entries(lock.packages)) {
    // ルートパッケージ（自分自身）と開発専用の依存は配布物に含まれない
    if (path === "" || entry.dev === true) {
      continue;
    }
    const name = entry.name ?? path.replace(/^.*node_modules\//, "");
    const dir = join(ROOT, path);
    let manifest = {};
    try {
      manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    } catch {
      /* インストールされていない場合は lock の情報だけで続行する */
    }
    const license =
      entry.license ??
      manifest.license ??
      (Array.isArray(manifest.licenses)
        ? manifest.licenses.map((l) => l.type).join(" OR ")
        : "(未宣言)");
    const repository =
      typeof manifest.repository === "string"
        ? manifest.repository
        : (manifest.repository?.url ?? "");

    results.push({
      name,
      version: entry.version ?? manifest.version ?? "",
      license: typeof license === "string" ? license : "(未宣言)",
      repository: repository.replace(/^git\+/, "").replace(/\.git$/, ""),
      copyright: findCopyright(dir),
    });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// レンダリング
// ---------------------------------------------------------------------------

function summarize(packages) {
  const counts = new Map();
  for (const pkg of packages) {
    counts.set(pkg.license, (counts.get(pkg.license) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function escapePipes(value) {
  return String(value).replaceAll("|", "\\|");
}

function renderTable(packages) {
  const lines = [
    "| パッケージ | バージョン | ライセンス | 著作権表示 |",
    "| --- | --- | --- | --- |",
  ];
  for (const pkg of packages) {
    const nameCell = pkg.repository
      ? `[${escapePipes(pkg.name)}](${pkg.repository})`
      : escapePipes(pkg.name);
    lines.push(
      `| ${nameCell} | ${escapePipes(pkg.version)} | ${escapePipes(pkg.license)} | ${escapePipes(pkg.copyright ?? "—")} |`,
    );
  }
  return lines.join("\n");
}

function renderSummary(entries) {
  const lines = ["| ライセンス | 件数 |", "| --- | --- |"];
  for (const [license, count] of entries) {
    lines.push(`| ${escapePipes(license)} | ${count} |`);
  }
  return lines.join("\n");
}

/**
 * コピーレフト系ライセンスを含むパッケージを抽出する。
 * 強いコピーレフト (GPL / AGPL) が混入した場合は MIT で配布できなくなるため、
 * 生成時に検出して失敗させる。
 */
function findCopyleft(packages) {
  const weak = [];
  for (const pkg of packages) {
    const license = pkg.license.toUpperCase();
    if (/\bA?GPL-/.test(license) && !/LGPL-/.test(license)) {
      throw new Error(
        `強いコピーレフトライセンスを検出しました: ${pkg.name} ${pkg.version} (${pkg.license})。` +
          `MIT での配布と両立しないため、依存を見直してください。`,
      );
    }
    if (/MPL-|LGPL-|EPL-|CDDL/.test(license)) {
      weak.push(pkg);
    }
  }
  return weak.sort((a, b) => a.name.localeCompare(b.name));
}

function renderCopyleftSection(weak) {
  if (weak.length === 0) {
    return "";
  }
  const rows = weak
    .map((p) => `| ${escapePipes(p.name)} | ${escapePipes(p.version)} | ${escapePipes(p.license)} |`)
    .join("\n");
  return `
## 弱いコピーレフトライセンスを含む依存 (${weak.length})

以下のパッケージはファイル単位のコピーレフトライセンスです。**該当ファイル自体を
改変した場合にのみ**そのソース開示義務が生じます。改変せずにライブラリとして
利用・リンクする分には、MatoMemo 本体を MIT で配布することと両立します
（MPL-2.0 第 3.3 条が「より大きな著作物」を別ライセンスで配布することを明示的に許諾）。

MatoMemo はこれらのパッケージを一切改変していません。

| パッケージ | バージョン | ライセンス |
| --- | --- | --- |
${rows}
`;
}

const rust = collectRustPackages();
const npm = collectNpmPackages();
const all = [...rust, ...npm];
const copyleft = findCopyleft(all);

const document = `# サードパーティライセンス一覧

MatoMemo は多くのオープンソースソフトウェアの上に成り立っています。
本ファイルは、配布される MatoMemo アプリケーションに含まれる依存関係と
そのライセンスの一覧です。

> このファイルは \`npm run licenses\` により自動生成されます。手で編集しないでください。
> 依存を追加・更新したら再生成してください（CI が陳腐化を検出します）。
>
> 対象は**配布物に含まれる依存のみ**です。ビルドツールやテストフレームワーク
> （Vite, Vitest, TypeScript, cargo のビルド依存など）は成果物に含まれないため
> 除外しています。

MatoMemo 自体のライセンスは [MIT License](./LICENSE) です。

## 概要

合計 ${all.length} パッケージ（Rust ${rust.length} / npm ${npm.length}）。

${renderSummary(summarize(all))}

いずれも許諾的（permissive）または弱いコピーレフトのライセンスであり、
MatoMemo を MIT License で配布することと両立します。GPL / AGPL などの
強いコピーレフトライセンスの依存はありません。
${renderCopyleftSection(copyleft)}
## Rust クレート (${rust.length})

\`src-tauri\` のバイナリにリンクされるクレートです。
\`cargo metadata --filter-platform aarch64-apple-darwin\` の解決グラフを
normal 依存のみ辿って抽出しています。

${renderTable(rust)}

## npm パッケージ (${npm.length})

フロントエンドのバンドルに含まれるパッケージです。

${renderTable(npm)}

## ライセンス全文について

各ライセンスの全文は、それぞれのパッケージに同梱されています。

- Rust クレート: \`~/.cargo/registry/src/*/<crate>-<version>/LICENSE*\`
- npm パッケージ: \`node_modules/<package>/LICENSE*\`

主要なライセンスの全文は以下で参照できます。

- [MIT License](https://opensource.org/licenses/MIT)
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- [ISC License](https://opensource.org/licenses/ISC)
- [BSD 2-Clause](https://opensource.org/licenses/BSD-2-Clause) / [BSD 3-Clause](https://opensource.org/licenses/BSD-3-Clause)
- [Blue Oak Model License 1.0.0](https://blueoakcouncil.org/license/1.0.0)
- [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/)
- [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- [Unicode License](https://www.unicode.org/license.txt)

## 商標について

Tauri および Tauri のロゴは Tauri プロジェクトの商標です。MatoMemo は Tauri を
利用していますが、Tauri プロジェクトによって承認・提携されたものではありません。
アプリケーションアイコンは MatoMemo 独自のものです（\`assets/app-icon.svg\`）。
`;

writeFileSync(join(ROOT, "THIRD_PARTY_LICENSES.md"), document);
console.log(
  `THIRD_PARTY_LICENSES.md を生成しました: Rust ${rust.length} / npm ${npm.length} = 合計 ${all.length} パッケージ`,
);
