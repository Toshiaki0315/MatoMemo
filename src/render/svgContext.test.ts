import { describe, expect, it } from "vitest";
import { SvgContext } from "./svgContext";

/** 固定幅 (1 文字 10px) で測るコンテキストを作る。 */
function createContext() {
  return new SvgContext((text) => text.length * 10);
}

describe("SvgContext: パス", () => {
  it("矩形を塗ると path 要素になる", () => {
    const svg = createContext();
    svg.beginPath();
    svg.rect(10, 20, 100, 50);
    svg.fillStyle = "#FFEE99";
    svg.fill();
    const output = svg.toSvg(200, 100);
    expect(output).toContain('<path d="M10 20h100v50h-100Z" fill="#FFEE99"');
  });

  it("塗ったあとに同じパスを枠線として描ける", () => {
    // Canvas ではパスは fill() で消えない。fill → stroke の順で使われる。
    const svg = createContext();
    svg.beginPath();
    svg.rect(0, 0, 10, 10);
    svg.fill();
    svg.strokeStyle = "#333333";
    svg.lineWidth = 2;
    svg.stroke();
    const output = svg.toSvg(10, 10);
    expect(output).toContain('stroke="#333333"');
    expect(output).toContain('stroke-width="2"');
  });

  it("破線の指定を stroke-dasharray にする", () => {
    const svg = createContext();
    svg.beginPath();
    svg.moveTo(0, 0);
    svg.lineTo(100, 0);
    svg.setLineDash([4, 2]);
    svg.stroke();
    expect(svg.toSvg(100, 10)).toContain('stroke-dasharray="4 2"');
  });

  it("角丸矩形は円弧を含む", () => {
    const svg = createContext();
    svg.beginPath();
    svg.roundRect(0, 0, 100, 60, 12);
    svg.fill();
    expect(svg.toSvg(100, 60)).toContain("a12 12 0 0 1");
  });

  it("楕円は 2 本の弧で一周する", () => {
    const svg = createContext();
    svg.beginPath();
    svg.ellipse(50, 25, 50, 25, 0, 0, Math.PI * 2);
    svg.fill();
    const output = svg.toSvg(100, 50);
    expect(output).toContain("a50 25 0 1 0 100 0");
    expect(output).toContain("a50 25 0 1 0 -100 0");
  });

  it("arcTo は接点までの直線と円弧になる", () => {
    // (0,0) から右へ進み、(100,0) の角を丸めて (100,100) へ下りる
    const svg = createContext();
    svg.beginPath();
    svg.moveTo(0, 0);
    svg.arcTo(100, 0, 100, 100, 8);
    svg.lineTo(100, 100);
    svg.stroke();
    const output = svg.toSvg(100, 100);
    expect(output).toContain("L92 0");
    expect(output).toContain("A8 8 0 0 1 100 8");
  });

  it("一直線上の arcTo は角までの直線になる", () => {
    const svg = createContext();
    svg.beginPath();
    svg.moveTo(0, 0);
    svg.arcTo(50, 0, 100, 0, 8);
    svg.stroke();
    expect(svg.toSvg(100, 10)).toContain("M0 0L50 0");
  });
});

describe("SvgContext: テキスト", () => {
  it("top 基準の文字はベースラインの分だけ下げて置く", () => {
    const svg = createContext();
    svg.font = '20px "Hiragino Sans", sans-serif';
    svg.textAlign = "center";
    svg.textBaseline = "top";
    svg.fillText("メモ", 100, 40);
    const output = svg.toSvg(200, 100);
    // 40 + 20 * 0.8 = 56
    expect(output).toContain('<text x="100" y="56"');
    expect(output).toContain('font-size="20"');
    expect(output).toContain('text-anchor="middle"');
    expect(output).toContain(">メモ</text>");
  });

  it("XML の特殊文字を無害化する", () => {
    const svg = createContext();
    svg.fillText("<a> & \"b\"", 0, 0);
    expect(svg.toSvg(10, 10)).toContain("&lt;a&gt; &amp; &quot;b&quot;");
  });

  it("文字幅は渡された測定関数で測る", () => {
    const svg = createContext();
    expect(svg.measureText("abc").width).toBe(30);
  });
});

describe("SvgContext: 変換と状態", () => {
  it("設定した変換を transform 属性として出す", () => {
    const svg = createContext();
    svg.setTransform(2, 0, 0, 2, 10, 20);
    svg.fillRect(0, 0, 5, 5);
    expect(svg.toSvg(10, 10)).toContain('transform="matrix(2 0 0 2 10 20)"');
  });

  it("恒等変換なら transform を出さない", () => {
    const svg = createContext();
    svg.fillRect(0, 0, 5, 5);
    expect(svg.toSvg(10, 10)).not.toContain("transform=");
  });

  it("save / restore でスタイルが戻る", () => {
    const svg = createContext();
    svg.fillStyle = "#111111";
    svg.save();
    svg.fillStyle = "#222222";
    svg.restore();
    svg.fillRect(0, 0, 5, 5);
    expect(svg.toSvg(10, 10)).toContain('fill="#111111"');
  });

  it("globalAlpha を opacity として出す", () => {
    const svg = createContext();
    svg.globalAlpha = 0.5;
    svg.fillRect(0, 0, 5, 5);
    expect(svg.toSvg(10, 10)).toContain('opacity="0.5"');
  });
});

describe("SvgContext: 画像と文書", () => {
  it("画像を data URL のまま埋め込む", () => {
    const svg = createContext();
    const image = { src: "data:image/png;base64,AA" } as CanvasImageSource;
    svg.drawImage(image, 10, 20, 100, 80);
    const output = svg.toSvg(200, 100);
    expect(output).toContain('href="data:image/png;base64,AA"');
    expect(output).toContain('width="100" height="80"');
  });

  it("SVG 文書としての枠を組み立てる", () => {
    const output = createContext().toSvg(320, 240);
    expect(output).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(output).toContain('width="320" height="240" viewBox="0 0 320 240"');
    expect(output.trimEnd().endsWith("</svg>")).toBe(true);
  });
});
