# MatoMemo

macOS (Apple Silicon) 向けの、ローカルで動く思考整理ホワイトボードアプリです。
付箋・図形・画像・テキストをキャンバスに自由に配置し、コネクタで結びつけて
考えをまとめられます。データはすべてローカルファイルとして保存され、
外部サーバーとの通信は行いません。

## 特徴

- **完全ローカル**: ボードは単一の JSON ファイルとして保存・読み込み
- **軽量ネイティブ**: Tauri 2 により約 10MB 台のアプリサイズ
- **多様なアイテム**: 付箋（パステル 6 色）／矩形・円／画像（PNG・JPG・BMP）／テキスト
- **コネクタ**: 直線・折れ線・曲線でアイテム同士を接続。アイテム移動に追従
- **重なり順の制御**: 最前面へ／最背面へ／一つ手前へ／一つ奥へ

## 動作環境

| 項目 | 要件 |
|---|---|
| OS | macOS 13 (Ventura) 以降 |
| CPU | Apple Silicon (arm64) |

## 開発環境のセットアップ

### 必要なもの

- [Node.js](https://nodejs.org/) 20 以降
- [Rust](https://www.rust-lang.org/tools/install) stable ツールチェイン
- Xcode Command Line Tools (`xcode-select --install`)

### 手順

```bash
git clone <this-repository>
cd MatoMemo
npm install
```

## コマンド

| コマンド | 説明 |
|---|---|
| `npm run tauri:dev` | デスクトップアプリを開発モードで起動 |
| `npm run dev` | フロントエンドのみを Vite 開発サーバーで起動 |
| `npm test` | テストを一度実行 |
| `npm run test:watch` | テストをウォッチモードで実行 |
| `npm run test:coverage` | カバレッジ付きでテストを実行 |
| `npm run typecheck` | TypeScript の型検査 |
| `npm run tauri:build` | Apple Silicon 向けアプリをビルド |
| `npm run licenses` | サードパーティライセンス一覧を再生成 |

ビルド成果物は `src-tauri/target/aarch64-apple-darwin/release/bundle/` に出力されます。

## アーキテクチャ

TDD を成立させるため、ドメインロジックとプラットフォーム依存コードを分離しています。

```
src/
  domain/     純 TypeScript のドメインロジック（DOM / Tauri 非依存）
  render/     Canvas 2D への描画
  platform/   Tauri 依存を閉じ込めるアダプタ層
  store/      アプリケーション状態 (Zustand)
  ui/         React コンポーネント
src-tauri/    Tauri (Rust) シェル
```

`domain/` は副作用のない純関数のみで構成され、カバレッジ 100% を維持します。
詳しい選定理由は [TECH_STACK.md](./TECH_STACK.md) を参照してください。

## 開発方針

本プロジェクトはテスト駆動開発 (TDD) で進めています。

1. テストを書く
2. 失敗することを確認する
3. 実装する
4. テストが通ることを確認する

進捗は [TASKS.md](./TASKS.md) で管理しています。

## ライセンス

MatoMemo は [MIT License](./LICENSE) で公開しています。

本アプリケーションが利用しているサードパーティ製ソフトウェアとそのライセンスの
一覧は [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) を参照してください。
`npm run licenses` で再生成できます。

### 商標について

Tauri および Tauri のロゴは Tauri プロジェクトの商標です。MatoMemo は Tauri を
利用していますが、Tauri プロジェクトによって承認・提携されたものではありません。
アプリケーションアイコンは MatoMemo 独自のもの（[assets/app-icon.svg](./assets/app-icon.svg)）です。
