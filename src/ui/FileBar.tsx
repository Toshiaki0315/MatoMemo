/**
 * ボード名の表示・編集と、ファイル操作をまとめたバー。
 */

export interface FileBarProps {
  readonly boardName: string;
  readonly onRename: (name: string) => void;
  /** 未保存の変更があるか。 */
  readonly dirty: boolean;
  readonly onNew: () => void;
  readonly onOpen: () => void;
  readonly onSave: () => void;
  readonly onSaveAs: () => void;
  readonly onExportMarkdown: () => void;
  /** 保存処理の実行中か。 */
  readonly busy?: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
}

export function FileBar({
  boardName,
  onRename,
  dirty,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onExportMarkdown,
  busy = false,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: FileBarProps) {
  return (
    <div className="file-bar" role="group" aria-label="ファイル操作">
      <input
        className="board-name"
        aria-label="ボード名"
        value={boardName}
        onChange={(event) => onRename(event.target.value)}
      />
      {/* 未保存であることは記号で示す。文字を出すと幅が変わって
          名前の入力欄が動いてしまうため */}
      <span
        className={dirty ? "dirty-mark is-dirty" : "dirty-mark"}
        aria-label={dirty ? "未保存の変更があります" : "保存済み"}
        role="status"
      >
        {dirty ? "●" : ""}
      </span>

      <div className="toolbar-separator" />

      <button type="button" onClick={onNew} disabled={busy}>
        新規
      </button>
      <button type="button" onClick={onOpen} disabled={busy}>
        開く
      </button>
      <button type="button" onClick={onSave} disabled={busy}>
        保存
      </button>
      <button type="button" onClick={onSaveAs} disabled={busy}>
        別名で保存
      </button>
      <button type="button" onClick={onExportMarkdown} disabled={busy}>
        Markdown 出力
      </button>

      <div className="toolbar-separator" />

      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="元に戻す"
        title="元に戻す (⌘Z)"
      >
        ↩
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label="やり直す"
        title="やり直す (⇧⌘Z)"
      >
        ↪
      </button>
    </div>
  );
}
