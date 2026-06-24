# Vesper — Confidential Wrapper Registry

> **Zama Developer Program · Mainnet Season 3 · Bounty Track**  
> Wrap ERC-20 tokens into encrypted ERC-7984 confidential tokens. Decrypt only what you choose to see.

**Live app:** https://confidential-vesper-registry.vercel.app  
**Docs:** https://confidential-vesper-registry.vercel.app/docs  
**Network:** Ethereum Sepolia (chainId 11155111)

---

## What is Vesper?

Vesper is a front-end for Zama's official **Confidential Wrapper Registry** deployed on Ethereum Sepolia. It reads the on-chain registry contract at [`0x2f0750Bbb0A246059d80e94c454586a7F27a128e`](https://sepolia.etherscan.io/address/0x2f0750Bbb0A246059d80e94c454586a7F27a128e), lists every valid ERC-20 ↔ ERC-7984 pair, and gives you a full UI to:

- **Wrap** public ERC-20 tokens into encrypted ERC-7984 cTokens — balances disappear on-chain the moment you wrap
- **Unwrap** back to ERC-20 via the async two-step FHE decryption flow
- **Decrypt** your confidential balance with an EIP-712 wallet signature — no transaction, nothing revealed publicly
- **Arbitrary decrypt** — paste any ERC-7984 contract address to reveal your balance in it
- **Faucet** — mint 1,000 test tokens of any pair in one click

All balance data is read live from chain. Nothing is simulated by the front-end.

---

## How it works

### FHE & ERC-7984

Zama's [fhEVM](https://docs.zama.ai/fhevm) brings Fully Homomorphic Encryption to Ethereum. Balances in ERC-7984 tokens are stored as `euint64` — an encrypted 64-bit integer. Nobody, including the chain itself, can read the value. Only the token holder can decrypt it, using a wallet-signed EIP-712 message.

### Wrap (ERC-20 → ERC-7984)

```
Approve ERC-20 → wrap(to, amount) → confidential balance increases (hidden)
```

The wrapper contract (`ERC7984ERC20Wrapper`) locks your underlying tokens and mints encrypted cTokens. All 8 pairs use `min(underlyingDecimals, 6)` as their confidential decimal precision, with a `rate()` factor bridging the gap — e.g. WETH has rate `10^12`, so wrapping 1 WETH gives 1 cWETH at 6 decimals.

### Unwrap (ERC-7984 → ERC-20, async 2-step)

```
unwrap(from, to, encryptedAmount, proof)
  → UnwrapRequested event + requestId
  → Zama relayer publicly decrypts the requestId amount
  → finalizeUnwrap(requestId, cleartext, proof) → ERC-20 released
```

Because the amount to burn is encrypted, the FHE coprocessor must decrypt it before underlying tokens can be released. The UI handles relayer polling and the `finalizeUnwrap` call automatically — just confirm the first transaction and wait.

### Decrypt (EIP-712, fully off-chain)

```
generateKeypair() → createEIP712() → signTypedData()
  → confidentialBalanceOf() → userDecrypt()
  → plaintext balance (never touches chain)
```

A temporary keypair is generated locally in your browser. You sign an EIP-712 message authorising the Zama Gateway to re-encrypt your balance with your public key. The result is decrypted locally — nothing is revealed on-chain.

---

## Token Registry (Sepolia)

All pairs registered by Zama at [`0x2f0750Bbb0A246059d80e94c454586a7F27a128e`](https://sepolia.etherscan.io/address/0x2f0750Bbb0A246059d80e94c454586a7F27a128e):

| Token | ERC-20 (underlying) | ERC-7984 (confidential) | Decimals → Conf |
|---|---|---|---|
| USDTMock | [0xa7dA08…e9b0](https://sepolia.etherscan.io/address/0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0) | [0x4E7B06…4491](https://sepolia.etherscan.io/address/0x4E7B06D78965594eB5EF5414c357ca21E1554491) | 6 → 6 (1:1) |
| USDCMock | [0x9b5Cd1…DFfF](https://sepolia.etherscan.io/address/0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF) | [0x7c5BF4…3639](https://sepolia.etherscan.io/address/0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639) | 6 → 6 (1:1) |
| WETHMock | [0xff5473…5f3F](https://sepolia.etherscan.io/address/0xff54739b16576FA5402F211D0b938469Ab9A5f3F) | [0x462086…3158](https://sepolia.etherscan.io/address/0x46208622DA27d91db4f0393733C8BA082ed83158) | 18 → 6 (10^12) |
| BRONMock | [0xFf021f…b25E](https://sepolia.etherscan.io/address/0xFf021fB13cA64e5354c62c954b949a88cfDEb25E) | [0xaa5612…C891](https://sepolia.etherscan.io/address/0xaa5612FA27c927a0c7961f5AEFEE5ba3A0F9C891) | 18 → 6 (10^12) |
| ZAMAMock | [0x753558…BF57](https://sepolia.etherscan.io/address/0x75355a85c6FB9df5f0C80FF54e8747EEe9a0BF57) | [0xf2D628…fbFB](https://sepolia.etherscan.io/address/0xf2D628d2598aF4eAF94CB76a437Ff86CA78FfbFB) | 18 → 6 (10^12) |
| tGBPMock | [0x93c931…1442](https://sepolia.etherscan.io/address/0x93c931278A2aad1916783F952f94276eA5111442) | [0xfCE5c7…7CC](https://sepolia.etherscan.io/address/0xfCE5c7069c5525eF6c8C2b2E35A745bA20a2F7CC) | 18 → 6 (10^12) |
| XAUtMock | [0x243778…d940](https://sepolia.etherscan.io/address/0x24377AE4AA0C45ecEe71225007f17c5D423dd940) | [0xe4FcF8…60C7](https://sepolia.etherscan.io/address/0xe4FcF848739845BC81Dee1d5352cf3844F0a60C7) | 6 → 6 (1:1) |
| tGBP | [0xf6ef9a…ff3](https://sepolia.etherscan.io/address/0xf6ef9adb61a48e29e36bc873070a46a3d2667ff3) | [0x167dc9…208](https://sepolia.etherscan.io/address/0x167dc962808b32cfffc7e14b5018c0be06a3a208) | 18 → 6 (10^12) |

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| FHE SDK | `@zama-ai/relayer-sdk` |
| Wallet | RainbowKit v2 + wagmi v2 |
| Chain reads/writes | viem |
| Deploy | Vercel |
| Network | Ethereum Sepolia |

**Key implementation details:**

- Uses `sendTransaction` with pre-encoded calldata + explicit gas limits (2M wrap/unwrap, 1M finalize) — bypasses MetaMask's internal `eth_estimateGas` which fails for FHE calls due to missing allowance in simulation context
- `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: credentialless` headers enable `SharedArrayBuffer`, allowing FHE WASM to use threads instead of blocking the main thread
- Zero-handle short-circuit: `confidentialBalanceOf` returns `bytes32(0)` for uninitialised balances — caught before hitting the relayer to avoid "User not allowed" errors
- Sequential registry metadata loading to stay within Sepolia public RPC rate limits

---

## Running locally

```bash
git clone https://github.com/HarshAnand1900/confidential-vesper-registry
cd confidential-vesper-registry
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Connect MetaMask (or any injected wallet) to **Sepolia** and get some Sepolia ETH from [sepoliafaucet.com](https://sepoliafaucet.com).

No `.env` file needed — the WalletConnect project ID is baked in for Sepolia.

---

## Bounty checklist

Built for **Zama Developer Program — Mainnet Season 3, Bounty Track** (deadline July 7 2026).

- [x] Read the official on-chain Wrappers Registry
- [x] List all ERC-20 ↔ ERC-7984 cTokenMock pairs
- [x] Wrap flow (`approve` + `wrap(address, uint256)`)
- [x] Unwrap flow (`unwrap` + relayer poll + `finalizeUnwrap`)
- [x] EIP-712 user-decryption (`userDecrypt`)
- [x] Arbitrary decrypt (any ERC-7984 address)
- [x] Faucet (`mint` on underlying mock tokens)

---

## License

MIT
