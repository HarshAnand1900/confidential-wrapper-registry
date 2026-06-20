import { parseAbi } from "viem";

export const REGISTRY_ADDRESS = "0x2f0750Bbb0A246059d80e94c454586a7F27a128e" as const;

export const REGISTRY_ABI = parseAbi([
  "function getTokenConfidentialTokenPairs() view returns ((address tokenAddress, address confidentialTokenAddress, bool isValid)[])",
  "function getTokenConfidentialTokenPairsLength() view returns (uint256)",
  "function getTokenConfidentialTokenPair(uint256 index) view returns ((address tokenAddress, address confidentialTokenAddress, bool isValid))",
  "function getConfidentialTokenAddress(address tokenAddress) view returns (bool isValid, address confidentialToken)",
  "function getTokenAddress(address confidentialWrapperAddress) view returns (bool isValid, address token)",
]);

export const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

export const ERC20_MOCK_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
]);

// Real on-chain interface is OpenZeppelin's ERC7984ERC20Wrapper (verified on Sepolia).
// euint64 / externalEuint64 are bytes32 on the wire.
//  - wrap(to, amount): `amount` is in UNDERLYING base units; contract mints amount/rate() confidential units.
//  - unwrap is async: submit an encrypted amount (6-dec confidential base units) -> get a requestId,
//    then finalizeUnwrap(requestId, cleartext, proof) releases the underlying.
//  - rate() = 10^(underlyingDecimals - confidentialDecimals); confidentialDecimals = min(underlying, 6).
export const WRAPPER_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function rate() view returns (uint256)",
  "function underlying() view returns (address)",
  "function confidentialBalanceOf(address account) view returns (bytes32)",
  "function wrap(address to, uint256 amount) returns (bytes32)",
  "function unwrap(address from, address to, bytes32 encryptedAmount, bytes inputProof) returns (bytes32)",
  "function finalizeUnwrap(bytes32 unwrapRequestId, uint64 unwrapAmountCleartext, bytes decryptionProof)",
  "function unwrapAmount(bytes32 unwrapRequestId) view returns (bytes32)",
  "event UnwrapRequested(address indexed receiver, bytes32 indexed unwrapRequestId, bytes32 amount)",
]);

// Confidential ERC-7984 tokens always use min(underlyingDecimals, 6) decimals.
export const CONFIDENTIAL_DECIMALS = 6;
export const confDecimalsOf = (underlyingDecimals: number) =>
  Math.min(underlyingDecimals, CONFIDENTIAL_DECIMALS);

// Purely-cosmetic glyph/color per token, keyed by the underlying ERC-20 address (lowercased).
// All real data (symbol/name/decimals/pairs) is read live from chain — this map only styles the UI.
const VISUALS: Record<string, { glyph: string; dotColor: string }> = {
  "0xa7da08fafdc9097cc0e7d4f113a61e31d7e8e9b0": { glyph: "₮", dotColor: "linear-gradient(135deg,#26A17B,#3ed6a6)" },
  "0x9b5cd13b8efbb58dc25a05cf411d8056058adfff": { glyph: "$", dotColor: "linear-gradient(135deg,#2775CA,#4f9bf0)" },
  "0xff54739b16576fa5402f211d0b938469ab9a5f3f": { glyph: "Ξ", dotColor: "linear-gradient(135deg,#627EEA,#a3b6ff)" },
  "0xff021fb13ca64e5354c62c954b949a88cfdeb25e": { glyph: "◈", dotColor: "linear-gradient(135deg,#F5AC37,#ffd17a)" },
  "0x75355a85c6fb9df5f0c80ff54e8747eee9a0bf57": { glyph: "Z", dotColor: "linear-gradient(135deg,#FFD60A,#ffaa3c)" },
  "0x93c931278a2aad1916783f952f94276ea5111442": { glyph: "£", dotColor: "linear-gradient(135deg,#1A4FD6,#5b87f5)" },
  "0x24377ae4aa0c45ecee71225007f17c5d423dd940": { glyph: "Au", dotColor: "linear-gradient(135deg,#F09242,#ffc089)" },
  "0xf6ef9adb61a48e29e36bc873070a46a3d2667ff3": { glyph: "£", dotColor: "linear-gradient(135deg,#159E6E,#46d6a0)" },
};

const FALLBACK_GRADIENTS = [
  "linear-gradient(135deg,#8E7CFF,#b9a8ff)",
  "linear-gradient(135deg,#26A17B,#3ed6a6)",
  "linear-gradient(135deg,#E06A9B,#ffa8cc)",
  "linear-gradient(135deg,#4f9bf0,#8fc2ff)",
];

// Deterministic cosmetic styling for any token, derived from its address when not in VISUALS.
export function visualFor(underlyingAddress: string, symbol?: string): { glyph: string; dotColor: string } {
  const key = underlyingAddress.toLowerCase();
  if (VISUALS[key]) return VISUALS[key];
  const seed = parseInt(key.slice(2, 6), 16) || 0;
  const glyph = (symbol ?? "?").replace(/^c/, "").slice(0, 2).toUpperCase() || "?";
  return { glyph, dotColor: FALLBACK_GRADIENTS[seed % FALLBACK_GRADIENTS.length] };
}

export type TokenPair = {
  tokenAddress: `0x${string}`;
  confidentialTokenAddress: `0x${string}`;
  isValid: boolean;
  // enriched metadata
  symbol?: string;
  name?: string;
  decimals?: number;
  confSymbol?: string;
  confName?: string;
  // visual metadata (Veil design)
  glyph?: string;
  dotColor?: string;
};

// Hardcoded fallback for Sepolia official pairs
export const FALLBACK_PAIRS: TokenPair[] = [
  {
    tokenAddress: "0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0",
    confidentialTokenAddress: "0x4E7B06D78965594eB5EF5414c357ca21E1554491",
    isValid: true,
    symbol: "USDTMock",
    name: "USDT Mock",
    decimals: 6,
    confSymbol: "cUSDTMock",
    confName: "Confidential USDT Mock",
    glyph: "₮",
    dotColor: "linear-gradient(135deg,#26A17B,#3ed6a6)",
  },
  {
    tokenAddress: "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF",
    confidentialTokenAddress: "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639",
    isValid: true,
    symbol: "USDCMock",
    name: "USDC Mock",
    decimals: 6,
    confSymbol: "cUSDCMock",
    confName: "Confidential USDC Mock",
    glyph: "$",
    dotColor: "linear-gradient(135deg,#2775CA,#4f9bf0)",
  },
  {
    tokenAddress: "0xff54739b16576FA5402F211D0b938469Ab9A5f3F",
    confidentialTokenAddress: "0x46208622DA27d91db4f0393733C8BA082ed83158",
    isValid: true,
    symbol: "WETHMock",
    name: "WETH Mock",
    decimals: 18,
    confSymbol: "cWETHMock",
    confName: "Confidential WETH Mock",
    glyph: "Ξ",
    dotColor: "linear-gradient(135deg,#627EEA,#a3b6ff)",
  },
  {
    tokenAddress: "0xFf021fB13cA64e5354c62c954b949a88cfDEb25E",
    confidentialTokenAddress: "0xaa5612FA27c927a0c7961f5AEFEE5ba3A0F9C891",
    isValid: true,
    symbol: "BRONMock",
    name: "BRON Mock",
    decimals: 18,
    confSymbol: "cBRONMock",
    confName: "Confidential BRON Mock",
    glyph: "◈",
    dotColor: "linear-gradient(135deg,#F5AC37,#ffd17a)",
  },
  {
    tokenAddress: "0x75355a85c6FB9df5f0C80FF54e8747EEe9a0BF57",
    confidentialTokenAddress: "0xf2D628d2598aF4eAF94CB76a437Ff86CA78FfbFB",
    isValid: true,
    symbol: "ZAMAMock",
    name: "ZAMA Mock",
    decimals: 18,
    confSymbol: "cZAMAMock",
    confName: "Confidential ZAMA Mock",
    glyph: "Z",
    dotColor: "linear-gradient(135deg,#FFD60A,#ffaa3c)",
  },
  {
    tokenAddress: "0x93c931278A2aad1916783F952f94276eA5111442",
    confidentialTokenAddress: "0xfCE5c7069c5525eF6c8C2b2E35A745bA20a2F7CC",
    isValid: true,
    symbol: "tGBPMock",
    name: "tGBP Mock",
    decimals: 18,
    confSymbol: "ctGBPMock",
    confName: "Confidential tGBP Mock",
    glyph: "£",
    dotColor: "linear-gradient(135deg,#1A4FD6,#5b87f5)",
  },
  {
    tokenAddress: "0x24377AE4AA0C45ecEe71225007f17c5D423dd940",
    confidentialTokenAddress: "0xe4FcF848739845BC81Dee1d5352cf3844F0a60C7",
    isValid: true,
    symbol: "XAUtMock",
    name: "XAUt Mock",
    decimals: 18,
    confSymbol: "cXAUtMock",
    confName: "Confidential XAUt Mock",
    glyph: "Au",
    dotColor: "linear-gradient(135deg,#F09242,#ffc089)",
  },
];
