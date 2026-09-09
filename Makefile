# MatoMemo の開発コマンド入口。OboeGaki / FudaCho と同じ流儀。
# アプリは Apple Silicon (arm64) 専用
TARGET := aarch64-apple-darwin
BUNDLE_DIR := src-tauri/target/$(TARGET)/release/bundle
APP := $(BUNDLE_DIR)/macos/MatoMemo.app

.PHONY: help setup run test check fmt app dmg clean

help: ## タスク一覧を表示
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  make %-8s %s\n", $$1, $$2}'

setup: ## 初回セットアップ
	npm install

# dev サーバのポート。既定 1420 は Tauri テンプレートの既定値で他アプリと
# 衝突しやすい。`MATOMEMO_DEV_PORT=1430 make run` で変えられる。
# tauri.conf.json の devUrl は静的なので、同じ値を --config で被せて揃える。
MATOMEMO_DEV_PORT ?= 1420

run: ## アプリ起動（Tauri dev = WKWebView。初回は Rust ビルドで数分）
	MATOMEMO_DEV_PORT=$(MATOMEMO_DEV_PORT) npm run tauri dev -- \
	  --config '{"build":{"devUrl":"http://localhost:$(MATOMEMO_DEV_PORT)"}}'

test: ## フロントエンドのテストを一度実行
	npm test

check: ## コミット前チェック（テスト + 型 + Rust）
	npm test
	npm run typecheck
	cd src-tauri && cargo fmt --check
	cd src-tauri && cargo clippy -- -D warnings

fmt: ## Rust のフォーマット修正
	cd src-tauri && cargo fmt

app: ## macOS アプリ (.app) をビルド。DMG は作らない
	npm run tauri:build -- --bundles app
	@echo "アプリ: $(APP)"
	@echo "開く:   open $(APP)"
	@echo "※ 署名・公証はまだ。初回は右クリック →「開く」で Gatekeeper を通す"

dmg: ## 配布用ディスクイメージ (.dmg) をビルド（.app も生成）
	npm run tauri:build -- --bundles app,dmg
	@echo "==> $(BUNDLE_DIR)/dmg/"

clean: ## ビルド成果物を削除
	rm -rf $(BUNDLE_DIR) dist
