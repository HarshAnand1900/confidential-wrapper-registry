import React from "react";

// Brand background gradients keyed by normalized symbol.
const BG: Record<string, string> = {
  usdt: "linear-gradient(135deg,#26A17B,#3ed6a6)",
  usdc: "linear-gradient(135deg,#2775CA,#4f9bf0)",
  weth: "linear-gradient(135deg,#627EEA,#8aa0f5)",
  bron: "linear-gradient(135deg,#F5AC37,#ffd17a)",
  zama: "linear-gradient(135deg,#FFD60A,#ffaa3c)",
  gbp: "linear-gradient(135deg,#1A4FD6,#5b87f5)",
  xau: "linear-gradient(135deg,#E6B43C,#ffd98a)",
  default: "linear-gradient(135deg,#8E7CFF,#b9a8ff)",
};

// Normalize "cWETHMock" / "WETHMock" / "tGBP" → key
function keyOf(symbol?: string): string {
  if (!symbol) return "default";
  const s = symbol.toLowerCase().replace(/^c/, "").replace(/mock$/, "").replace(/^t/, "");
  if (s.includes("usdt")) return "usdt";
  if (s.includes("usdc")) return "usdc";
  if (s.includes("weth") || s.includes("eth")) return "weth";
  if (s.includes("bron")) return "bron";
  if (s.includes("zama")) return "zama";
  if (s.includes("gbp")) return "gbp";
  if (s.includes("xau")) return "xau";
  return "default";
}

// Inner vector mark per token, drawn in a 32×32 viewBox.
function Mark({ k }: { k: string }) {
  const w = "#fff";
  switch (k) {
    case "weth": // Ethereum diamond
      return (
        <g fill={w}>
          <path d="M16 4 L16 13.2 L23.6 16.6 Z" opacity="0.55" />
          <path d="M16 4 L8.4 16.6 L16 13.2 Z" />
          <path d="M16 21.5 L16 28 L23.6 18 Z" opacity="0.55" />
          <path d="M16 28 L16 21.5 L8.4 18 Z" />
        </g>
      );
    case "usdt": // Tether ₮
      return (
        <g fill={w}>
          <rect x="6.5" y="8" width="19" height="3.2" rx="1.2" />
          <rect x="14.2" y="9" width="3.6" height="15" rx="1.2" />
          <ellipse cx="16" cy="15.2" rx="7.5" ry="2.7" fill="none" stroke={w} strokeWidth="2.4" />
        </g>
      );
    case "usdc": // USDC — ring + $
      return (
        <g fill="none" stroke={w} strokeWidth="2.3">
          <circle cx="16" cy="16" r="9" />
          <path d="M16 9.5 L16 22.5" strokeLinecap="round" />
          <path d="M19 12 C19 10.3 17.6 9.5 16 9.5 C14.4 9.5 13 10.3 13 12 C13 13.7 14.4 14.4 16 14.8 C17.6 15.2 19 15.9 19 17.6 C19 19.3 17.6 20.1 16 20.1 C14.4 20.1 13 19.3 13 17.6" strokeLinecap="round" />
        </g>
      );
    case "gbp": // Pound £
      return (
        <text x="16" y="22.5" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontWeight="700" fontSize="18" fill={w}>£</text>
      );
    case "xau": // Gold bar
      return (
        <g fill={w}>
          <path d="M8 19 L24 19 L22 24 L10 24 Z" opacity="0.95" />
          <path d="M10.5 13 L21.5 13 L20 18 L12 18 Z" opacity="0.7" />
        </g>
      );
    case "zama": // Stylized Z
      return (
        <g fill="#1a1407">
          <path d="M9 9 L23 9 L23 12.5 L14 19.5 L23 19.5 L23 23 L9 23 L9 19.5 L18 12.5 L9 12.5 Z" />
        </g>
      );
    case "bron": // Diamond ◈
      return (
        <g fill={w}>
          <path d="M16 5 L25 16 L16 27 L7 16 Z" opacity="0.95" />
          <path d="M16 11 L21 16 L16 21 L11 16 Z" fill="#F5AC37" />
        </g>
      );
    default:
      return (
        <text x="16" y="22" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontWeight="700" fontSize="15" fill={w}>?</text>
      );
  }
}

export function TokenIcon({ symbol, size = 42, radius }: { symbol?: string; size?: number; radius?: number }) {
  const k = keyOf(symbol);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: radius ?? Math.round(size * 0.3),
        background: BG[k], display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, boxShadow: "inset 0 1px 2px rgba(255,255,255,.25), inset 0 -2px 4px rgba(0,0,0,.18)",
      }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 32 32">
        <Mark k={k} />
      </svg>
    </div>
  );
}
