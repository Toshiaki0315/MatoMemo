# 技術選定 (Technology Decision Record)

決定日: 2026-08-30
対象: MatoMemo — macOS (Apple Silicon) 向けローカル思考整理ホワイトボードアプリ

## 決定内容

| 領域 | 採用技術 |
|---|---|
| デスクトップシェル | **Tauri 2** |
| UI フレームワーク | **React 19** |
| 言語 | **TypeScript 5.8**（strict） |
| ビルドツール | **Vite 7** |
| テスト | **Vitest 3** + @testing-library/react + jsdom |
| カバレッジ | **@vitest/coverage-v8** |
| キャンバス描画 | **Canvas 2D + 自前レンダラ** |
| 状態管理 | **Zustand**（薄いストア。ドメインロジックは純関数に分離） |
| ファイル I/O | **@tauri-apps/plugin-fs / plugin-dialog** |
| CI | **GitHub Actions**（ubuntu-latest でテスト + カバレッジ） |

## 選定理由

### なぜ Tauri 2 か（vs Electron）

- **配布サイズ / メモリ**: Tauri は OS 標準の WKWebView を利用するため約 10–15MB。Electron は Chromium を同梱し 200MB 超。「単一ユーザー向けローカルアプリ」という要件に対し、Chromium 同梱のコストに見合う利点がない。
- **Apple Silicon ネイティブ**: aarch64-apple-darwin ターゲットで直接ビルドでき、要件の「Apple Silicon 専用」に素直に合致する。
- **Rust コードを書かずに済む**: ファイルダイアログとファイル I/O は公式プラグイン（`plugin-dialog` / `plugin-fs`）で完結する。結果としてテスト対象言語が TypeScript 1 本に収まり、カバレッジも 1 系統で管理できる（TDD 要件にとって重要）。

### なぜ Canvas 2D 自前レンダラか（vs SVG / Konva 等）

- 描画・当たり判定・座標変換をすべて**副作用のない純関数**として実装でき、DOM に依存しないユニットテストで高いカバレッジを取れる。
- アイテム数が数千規模になってもパン / ズームのフレームレートを維持できる（SVG は DOM ノード数に比例して劣化する）。
- 外部描画ライブラリを使うとリサイズハンドルやドラッグの中核ロジックがライブラリ内部に入り、カバレッジ計測対象外かつテスト不能になる。TDD 要件と相性が悪い。
- テキスト編集時のみ、Canvas の上に DOM の `<textarea>` をオーバーレイして IME 入力に対応する。

## アーキテクチャ方針

TDD とカバレッジ 100% 近傍を実現するため、**ドメインコアとプラットフォーム層を厳格に分離**する。

```
src/
  domain/        # 純 TypeScript。DOM / Tauri / React に一切依存しない（カバレッジ目標 100%）
    board.ts         ボード・アイテム・コネクタのモデルと不変更新
    geometry.ts      矩形・点・ヒットテスト・リサイズ計算
    viewport.ts      screen ↔ world 座標変換、ズーム
    zorder.ts        Z-index 操作
    connector.ts     コネクタ経路（直線 / 折れ線 / 曲線）算出
    serialize.ts     保存フォーマットのシリアライズ / バリデーション
    image/bmp.ts     BMP デコーダ
  render/        # Canvas 2D 描画。CanvasRenderingContext2D のモックでテスト
  platform/      # Tauri 依存を閉じ込めるアダプタ（インタフェース経由でモック可能）
  store/         # Zustand ストア
  ui/            # React コンポーネント
```

- `domain/` は入力に対して新しい状態を返す純関数のみ。ここが最も厚く、最もテストされる層。
- `platform/` は `FileStore` インタフェースを定義し、実装を Tauri 版とインメモリ版（テスト用）で差し替える。
- CI は `ubuntu-latest` で `npm test` を実行する。jsdom で完結するため macOS runner は不要（コスト 1/10）。macOS ビルド検証が必要になった段階で別ジョブを追加する。

## 補足: BMP を自前デコードする理由

要件で PNG / JPG / BMP のインポートが明記されている。PNG / JPG は WebView の `<img>` で扱えるが、WKWebView の BMP 対応はバージョン・エンコーディング依存のリスクがある。BMP はヘッダ構造が単純なため、TypeScript でデコーダを実装する（`domain/image/bmp.ts`）。これにより動作が保証され、かつヘッダ解析ロジックは純関数としてテストしやすい。
