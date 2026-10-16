/**
 * 選択した線の設定パネル。
 *
 * 線を選んでいる間だけ現れ、種類と矢印を変えたり削除したりできる。
 */

import {
  ANCHOR_SIDES,
  attachConnectorEnd,
  CAP_SIZES,
  END_CAPS,
  type AnchorSide,
  STROKE_STYLES,
  STROKE_WIDTHS,
  type CapSize,
  type Connector,
  type ConnectorKind,
  type EndCap,
  type StrokeStyle,
} from "../domain/board";

/** 線の種類の表示名。 */
const KIND_LABELS: Record<ConnectorKind, string> = {
  straight: "直線",
  polyline: "折れ線",
  curved: "曲線",
};

/** 線種の表示名。 */
export const STROKE_STYLE_LABELS: Record<StrokeStyle, string> = {
  solid: "実線",
  dashed: "破線",
  dotted: "点線",
  dashDot: "一点鎖線",
};

/** 端の印の表示名。 */
export const END_CAP_LABELS: Record<EndCap, string> = {
  none: "なし",
  arrow: "矢印",
  circle: "丸",
};

/** 印の大きさの表示名。 */
export const CAP_SIZE_LABELS: Record<CapSize, string> = {
  small: "小",
  medium: "中",
  large: "大",
};

/** 接続ポイントの表示名。 */
export const ANCHOR_SIDE_LABELS: Record<AnchorSide, string> = {
  top: "上",
  topRight: "右上",
  right: "右",
  bottomRight: "右下",
  bottom: "下",
  bottomLeft: "左下",
  left: "左",
  topLeft: "左上",
};

/** 接続ポイントの選択肢のうち「自動」を表す値。辺の名前と重ならない。 */
const AUTO_SIDE = "auto";

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
        太さ
        <select
          value={connector.strokeWidth}
          onChange={(event) =>
            onChange({ ...connector, strokeWidth: Number(event.target.value) })
          }
        >
          {STROKE_WIDTHS.map((width) => (
            <option key={width} value={width}>
              {width}
            </option>
          ))}
        </select>
      </label>

      <label>
        線種
        <select
          value={connector.strokeStyle}
          onChange={(event) =>
            onChange({
              ...connector,
              strokeStyle: event.target.value as StrokeStyle,
            })
          }
        >
          {STROKE_STYLES.map((style) => (
            <option key={style} value={style}>
              {STROKE_STYLE_LABELS[style]}
            </option>
          ))}
        </select>
      </label>

      <label>
        始点
        <select
          value={connector.startCap}
          onChange={(event) =>
            onChange({ ...connector, startCap: event.target.value as EndCap })
          }
        >
          {END_CAPS.map((cap) => (
            <option key={cap} value={cap}>
              {END_CAP_LABELS[cap]}
            </option>
          ))}
        </select>
      </label>

      <label>
        終点
        <select
          value={connector.endCap}
          onChange={(event) =>
            onChange({ ...connector, endCap: event.target.value as EndCap })
          }
        >
          {END_CAPS.map((cap) => (
            <option key={cap} value={cap}>
              {END_CAP_LABELS[cap]}
            </option>
          ))}
        </select>
      </label>

      <AnchorSelect
        label="始点の位置"
        connector={connector}
        end="from"
        onChange={onChange}
      />

      <AnchorSelect
        label="終点の位置"
        connector={connector}
        end="to"
        onChange={onChange}
      />

      <label>
        端の大きさ
        <select
          value={connector.capSize}
          onChange={(event) =>
            onChange({ ...connector, capSize: event.target.value as CapSize })
          }
        >
          {CAP_SIZES.map((size) => (
            <option key={size} value={size}>
              {CAP_SIZE_LABELS[size]}
            </option>
          ))}
        </select>
      </label>

      <button type="button" onClick={onDelete}>
        線を削除
      </button>
    </div>
  );
}

/**
 * 片方の端の接続ポイントの選択欄。
 * 自動を選ぶと、2 つのアイテムの位置関係から向かい合う辺につなぐ。
 */
function AnchorSelect({
  label,
  connector,
  end,
  onChange,
}: {
  readonly label: string;
  readonly connector: Connector;
  readonly end: "from" | "to";
  readonly onChange: (connector: Connector) => void;
}) {
  const side = end === "from" ? connector.fromSide : connector.toSide;
  const itemId = end === "from" ? connector.fromItemId : connector.toItemId;
  return (
    <label>
      {label}
      <select
        value={side ?? AUTO_SIDE}
        onChange={(event) => {
          const value = event.target.value;
          onChange(
            attachConnectorEnd(
              connector,
              end,
              itemId,
              value === AUTO_SIDE ? undefined : (value as AnchorSide),
            ),
          );
        }}
      >
        <option value={AUTO_SIDE}>自動</option>
        {ANCHOR_SIDES.map((value) => (
          <option key={value} value={value}>
            {ANCHOR_SIDE_LABELS[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
