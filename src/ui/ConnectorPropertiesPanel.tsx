/**
 * 選択した線の設定パネル。
 *
 * 線を選んでいる間だけ現れ、種類と矢印を変えたり削除したりできる。
 */

import type { Connector, ConnectorKind } from "../domain/board";

/** 線の種類の表示名。 */
const KIND_LABELS: Record<ConnectorKind, string> = {
  straight: "直線",
  polyline: "折れ線",
  curved: "曲線",
};

export interface ConnectorPropertiesPanelProps {
  readonly connector: Connector;
  /** 設定を変えた線を渡す。 */
  readonly onChange: (connector: Connector) => void;
  readonly onDelete: () => void;
}

export function ConnectorPropertiesPanel({
  connector,
  onChange,
  onDelete,
}: ConnectorPropertiesPanelProps) {
  return (
    <div className="connector-properties" role="group" aria-label="線の設定">
      <label>
        種類
        <select
          value={connector.kind}
          onChange={(event) =>
            onChange({ ...connector, kind: event.target.value as ConnectorKind })
          }
        >
          {(Object.keys(KIND_LABELS) as ConnectorKind[]).map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </label>

      <label>
        <input
          type="checkbox"
          checked={connector.arrow}
          onChange={(event) =>
            onChange({ ...connector, arrow: event.target.checked })
          }
        />
        矢印
      </label>

      <button type="button" onClick={onDelete}>
        線を削除
      </button>
    </div>
  );
}
