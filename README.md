# Confidential Wrapper Registry

A production-ready dApp that turns the [Zama Wrappers Registry](https://docs.zama.ai) into a usable product. Browse every official ERC-20 ↔ ERC-7984 confidential wrapper pair on Sepolia, wrap/unwrap tokens, decrypt your confidential balances, and mint test tokens from the faucet.

**Live URL:** _Add after Vercel deploy_  
**Network:** Sepolia (chainId 11155111)

---

## Features

- **Registry browser** — reads the official onchain Wrappers Registry at `0x2f0750Bbb0A246059d80e94c454586a7F27a128e` and lists all valid ERC-20 ↔ ERC-7984 pairs with metadata
- **Faucet** — mints 1,000 test tokens from each official cTokenMock's public `mint()` function
- **Wrap** — approve ERC-20 → call `wrap(uint64)` on the confidential wrapper
- **Unwrap** — call `unwrap(uint64)` to burn confidential balance and receive ERC-20 back
- **Decrypt balance** — EIP-712 user-decryption flow via Zama relayer SDK for any ERC-7984 token
- **Arbitrary decrypt** — paste any ERC-7984 contract address to decrypt your balance outside the registry

## Tech Stack

- Next.js 16, TypeScript, Tailwind CSS
- wagmi v2 + viem for onchain reads/writes
- @rainbow-me/rainbowkit for wallet connection
- @zama-fhe/relayer-sdk@0.4.4 for FHE operations

## Getting Started

```bash
npm install
# Set your WalletConnect project ID (free at https://cloud.walletconnect.com)
echo "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_id_here" > .env.local
npm run dev
```

## How Registry Sourcing Works

The app uses a **hybrid strategy**:

1. **Primary — onchain registry**: reads `getTokenConfidentialTokenPairs()` from the official `WrapperRegistry` contract on Sepolia. This is the canonical source of truth.
2. **Secondary — local config**: `src/lib/registry.ts` contains `FALLBACK_PAIRS`, used to:
   - Supply metadata (symbol, name, decimals) not stored onchain
   - Provide a fallback if the registry read fails
   - Support custom/dev-only pairs not yet registered onchain

Pairs are merged: onchain entries take precedence; any `FALLBACK_PAIRS` entry not found onchain is appended to the list.

## Adding a New ERC-20 ↔ ERC-7984 Pair

**Option 1 — Local config only (dev/custom pairs)**

Add an entry to `FALLBACK_PAIRS` in [`src/lib/registry.ts`](src/lib/registry.ts):

```ts
{
  tokenAddress: "0xYourERC20Address",
  confidentialTokenAddress: "0xYourERC7984WrapperAddress",
  isValid: true,
  symbol: "myToken",
  name: "My Token",
  decimals: 18,
  confSymbol: "cmyToken",
  confName: "Confidential My Token",
},
```

The pair will appear in the UI immediately on next deploy. No contract changes needed.

**Option 2 — Onchain registration**

Once your pair is registered in the official `WrapperRegistry` contract on Sepolia, it is picked up automatically on the next page load — no app changes needed.

## Official Sepolia Pairs

| Symbol     | Underlying ERC-20                            | ERC-7984 Wrapper                             |
|------------|----------------------------------------------|----------------------------------------------|
| cUSDTMock  | 0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0   | 0x4E7B06D78965594eB5EF5414c357ca21E1554491   |
| cUSDCMock  | 0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF   | 0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639   |
| cWETHMock  | 0xff54739b16576FA5402F211D0b938469Ab9A5f3F   | 0x46208622DA27d91db4f0393733C8BA082ed83158   |
| cBRONMock  | 0xFf021fB13cA64e5354c62c954b949a88cfDEb25E   | 0xaa5612FA27c927a0c7961f5AEFEE5ba3A0F9C891   |
| cZAMAMock  | 0x75355a85c6FB9df5f0C80FF54e8747EEe9a0BF57   | 0xf2D628d2598aF4eAF94CB76a437Ff86CA78FfbFB   |
| ctGBPMock  | 0x93c931278A2aad1916783F952f94276eA5111442   | 0xfCE5c7069c5525eF6c8C2b2E35A745bA20a2F7CC   |
| cXAUtMock  | 0x24377AE4AA0C45ecEe71225007f17c5D423dd940   | 0xe4FcF848739845BC81Dee1d5352cf3844F0a60C7   |

Registry: `0x2f0750Bbb0A246059d80e94c454586a7F27a128e`

## Deployment

```bash
npm run build
vercel --prod
```

Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in Vercel environment variables.
