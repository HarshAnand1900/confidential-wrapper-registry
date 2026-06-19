"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useChainId,
  useDisconnect,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { formatUnits, parseUnits } from "viem";
import {
  REGISTRY_ABI,
  REGISTRY_ADDRESS,
  ERC20_ABI,
  ERC20_MOCK_ABI,
  WRAPPER_ABI,
  FALLBACK_PAIRS,
  type TokenPair,
} from "@/lib/registry";
import { getFhevm } from "@/lib/fhe";
import { VeilCanvas } from "@/components/VeilCanvas";

type Tab = "registry" | "wrap" | "decrypt" | "faucet";
type Theme = "dark" | "light";
type Accent = "gold" | "aurora" | "cyber";
type ViewMode = "cards" | "table";

type Toast = { icon: string; iconBg: string; title: string; sub: string; n: number } | null;

type ArbResult = {
  sym: string; name: string; glyph: string; dotColor: string;
  short: string; value: string; handle: string; time: string;
} | null;

const idOf = (p: TokenPair) => p.confidentialTokenAddress.toLowerCase();

function fmtNum(n: number) {
  if (n === undefined || n === null || Number.isNaN(n)) return "0";
  const dec = n % 1 === 0 ? 0 : n < 1 ? 4 : 2;
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function short(a: string) {
  return a.slice(0, 6) + "…" + a.slice(-4);
}
function cipherFor(id: string) {
  return "••" + id.slice(2, 5) + "··" + id.slice(-3) + "••";
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const heroRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  // Avoid SSR/client hydration mismatch: wagmi reconnects after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const screen: "landing" | "app" = mounted && isConnected ? "app" : "landing";
  const wrongNetwork = mounted && isConnected && chainId !== sepolia.id;

  const [tab, setTab] = useState<Tab>("registry");
  const [theme, setTheme] = useState<Theme>("dark");
  const [accent] = useState<Accent>("gold");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const [pairs, setPairs] = useState<TokenPair[]>(FALLBACK_PAIRS);
  const [registrySource, setRegistrySource] = useState<"onchain + local" | "local fallback">("local fallback");
  const [erc20Bal, setErc20Bal] = useState<Record<string, bigint>>({});

  const [decrypted, setDecrypted] = useState<Record<string, boolean>>({});
  const [decrypting, setDecrypting] = useState<Record<string, boolean>>({});
  const [decryptedVal, setDecryptedVal] = useState<Record<string, number>>({});

  const [wrapPairId, setWrapPairId] = useState<string>("");
  const [wrapMode, setWrapMode] = useState<"wrap" | "unwrap">("wrap");
  const [wrapStep, setWrapStep] = useState(0); // 0 idle,1 approve,2 wrap,3 done
  const [amount, setAmount] = useState("");

  const [arbAddr, setArbAddr] = useState("");
  const [arbBusy, setArbBusy] = useState(false);
  const [arbResult, setArbResult] = useState<ArbResult>(null);

  const [faucetBusy, setFaucetBusy] = useState<Record<string, boolean>>({});
  const [faucetDone, setFaucetDone] = useState<Record<string, boolean>>({});

  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((icon: string, iconBg: string, title: string, sub: string) => {
    const t = { icon, iconBg, title, sub, n: Date.now() };
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToast((cur) => (cur && cur.n === t.n ? null : cur));
    }, 3600);
  }, []);

  const byId = useCallback((id: string) => pairs.find((p) => idOf(p) === id), [pairs]);

  // ---------- load registry ----------
  const loadPairs = useCallback(async () => {
    if (!publicClient) return;
    try {
      const raw = await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "getTokenConfidentialTokenPairs",
      });
      const enriched: TokenPair[] = raw
        .filter((p) => p.isValid)
        .map((p) => {
          const fb = FALLBACK_PAIRS.find(
            (f) => f.tokenAddress.toLowerCase() === p.tokenAddress.toLowerCase()
          );
          return {
            tokenAddress: p.tokenAddress,
            confidentialTokenAddress: p.confidentialTokenAddress,
            isValid: p.isValid,
            symbol: fb?.symbol, name: fb?.name, decimals: fb?.decimals,
            confSymbol: fb?.confSymbol, confName: fb?.confName,
            glyph: fb?.glyph ?? "?",
            dotColor: fb?.dotColor ?? "linear-gradient(135deg,#888,#bbb)",
          };
        });
      for (const fb of FALLBACK_PAIRS) {
        if (!enriched.find((e) => e.tokenAddress.toLowerCase() === fb.tokenAddress.toLowerCase()))
          enriched.push(fb);
      }
      setPairs(enriched.length ? enriched : FALLBACK_PAIRS);
      setRegistrySource(enriched.length ? "onchain + local" : "local fallback");
      if (!wrapPairId && enriched.length) setWrapPairId(idOf(enriched[0]));
    } catch {
      setPairs(FALLBACK_PAIRS);
      setRegistrySource("local fallback");
      if (!wrapPairId) setWrapPairId(idOf(FALLBACK_PAIRS[0]));
    }
  }, [publicClient, wrapPairId]);

  const loadBalances = useCallback(async () => {
    if (!publicClient || !address || pairs.length === 0) return;
    const res = await Promise.allSettled(
      pairs.map(async (p) => {
        const bal = await publicClient.readContract({
          address: p.tokenAddress, abi: ERC20_ABI, functionName: "balanceOf", args: [address],
        });
        return [idOf(p), bal] as [string, bigint];
      })
    );
    const next: Record<string, bigint> = {};
    for (const r of res) if (r.status === "fulfilled") next[r.value[0]] = r.value[1];
    setErc20Bal(next);
  }, [publicClient, address, pairs]);

  useEffect(() => {
    loadPairs();
  }, [loadPairs]);
  useEffect(() => {
    if (isConnected) loadBalances();
  }, [isConnected, loadBalances]);
  useEffect(() => {
    if (!wrapPairId && pairs.length) setWrapPairId(idOf(pairs[0]));
  }, [pairs, wrapPairId]);

  // ---------- decrypt ----------
  const runUserDecrypt = useCallback(
    async (confAddr: `0x${string}`): Promise<bigint> => {
      if (!address || !walletClient || !publicClient) throw new Error("Wallet not ready");
      const provider = (window as { ethereum?: unknown }).ethereum as import("ethers").Eip1193Provider;
      const fhevm = await getFhevm(provider);
      const { publicKey, privateKey } = fhevm.generateKeypair();
      const startTs = Math.floor(Date.now() / 1000);
      const eip712 = fhevm.createEIP712(publicKey, [confAddr], startTs, 7);
      const sig = await walletClient.signTypedData(
        eip712 as Parameters<typeof walletClient.signTypedData>[0]
      );
      const handle = await publicClient.readContract({
        address: confAddr, abi: WRAPPER_ABI, functionName: "confidentialBalanceOf", args: [address],
      });
      const result = await fhevm.userDecrypt(
        [{ handle, contractAddress: confAddr }],
        privateKey, publicKey, sig.replace("0x", ""), [confAddr], address, startTs, 7
      );
      return Object.values(result)[0] as bigint;
    },
    [address, walletClient, publicClient]
  );

  const decrypt = (id: string) => async () => {
    if (decrypting[id] || decrypted[id]) return;
    const p = byId(id);
    if (!p) return;
    setDecrypting((s) => ({ ...s, [id]: true }));
    try {
      const plain = await runUserDecrypt(p.confidentialTokenAddress);
      const val = Number(formatUnits(plain, p.decimals ?? 18));
      setDecryptedVal((s) => ({ ...s, [id]: val }));
      setDecrypted((s) => ({ ...s, [id]: true }));
      showToast("🔓", "var(--violet)", "Balance decrypted", (p.confSymbol ?? p.symbol ?? "") + " · EIP-712 verified");
    } catch (e) {
      showToast("!", "var(--bad)", "Decryption failed", e instanceof Error ? e.message.slice(0, 60) : "Error");
    } finally {
      setDecrypting((s) => ({ ...s, [id]: false }));
    }
  };

  // ---------- wrap / unwrap ----------
  const goWrap = (id: string, mode: "wrap" | "unwrap") => () => {
    setWrapPairId(id); setWrapMode(mode); setWrapStep(0); setAmount(""); setTab("wrap");
  };
  const onMax = () => {
    const p = byId(wrapPairId);
    if (!p) return;
    const v = wrapMode === "wrap"
      ? Number(formatUnits(erc20Bal[wrapPairId] ?? BigInt(0), p.decimals ?? 18))
      : (decryptedVal[wrapPairId] ?? 0);
    setAmount(String(v)); setWrapStep(0);
  };

  const confirmWrap = async () => {
    const p = byId(wrapPairId);
    if (!p || !walletClient || !publicClient) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || wrapStep !== 0) return;
    const decimals = p.decimals ?? 18;
    let amtBig: bigint;
    try {
      amtBig = parseUnits(amount, decimals);
    } catch {
      showToast("!", "var(--bad)", "Invalid amount", "Enter a valid number");
      return;
    }
    if (wrongNetwork) {
      switchChain({ chainId: sepolia.id });
      return;
    }
    try {
      if (wrapMode === "wrap") {
        const have = erc20Bal[wrapPairId] ?? BigInt(0);
        if (amtBig > have) {
          showToast("!", "var(--bad)", "Insufficient balance", `You only have ${fmtNum(Number(formatUnits(have, decimals)))} ${p.symbol}`);
          return;
        }
        setWrapStep(1);
        const approveTx = await walletClient.writeContract({
          address: p.tokenAddress, abi: ERC20_ABI, functionName: "approve",
          args: [p.confidentialTokenAddress, amtBig],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
        setWrapStep(2);
        const wrapTx = await walletClient.writeContract({
          address: p.confidentialTokenAddress, abi: WRAPPER_ABI, functionName: "wrap",
          args: [amtBig],
        });
        await publicClient.waitForTransactionReceipt({ hash: wrapTx });
        setWrapStep(3);
        // freshly wrapped → re-encrypt the displayed confidential balance
        setDecrypted((s) => ({ ...s, [wrapPairId]: false }));
        setDecryptedVal((s) => {
          const n = { ...s };
          delete n[wrapPairId];
          return n;
        });
        showToast("✓", "var(--good)", `Wrapped ${fmtNum(amt)} ${p.symbol}`, "Balance is now confidential");
      } else {
        setWrapStep(2);
        const unwrapTx = await walletClient.writeContract({
          address: p.confidentialTokenAddress, abi: WRAPPER_ABI, functionName: "unwrap",
          args: [amtBig],
        });
        await publicClient.waitForTransactionReceipt({ hash: unwrapTx });
        setWrapStep(3);
        showToast("✓", "var(--good)", `Unwrapped ${fmtNum(amt)} ${p.confSymbol ?? p.symbol}`, "Now public on Sepolia");
      }
      loadBalances();
      setTimeout(() => {
        setWrapStep((s) => (s === 3 ? 0 : s));
        setAmount("");
      }, 2400);
    } catch (e) {
      setWrapStep(0);
      const msg = e instanceof Error ? e.message : "Transaction failed";
      showToast("!", "var(--bad)", "Transaction failed", msg.slice(0, 60));
    }
  };

  // ---------- arbitrary decrypt ----------
  const arbDecrypt = async () => {
    const addr = arbAddr.trim();
    if (addr.length < 6 || arbBusy) return;
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      showToast("!", "var(--bad)", "Invalid address", "Paste a valid ERC-7984 address");
      return;
    }
    if (wrongNetwork) {
      switchChain({ chainId: sepolia.id });
      return;
    }
    setArbBusy(true);
    setArbResult(null);
    try {
      const match = pairs.find((r) => r.confidentialTokenAddress.toLowerCase() === addr.toLowerCase());
      const decimals = match?.decimals ?? 18;
      const plain = await runUserDecrypt(addr as `0x${string}`);
      const val = Number(formatUnits(plain, decimals));
      const handle = "0x" + Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join("") +
        "…" + Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      setArbResult({
        sym: match?.confSymbol ?? "cTKN",
        name: match?.confName ?? "ERC-7984 token",
        glyph: match?.glyph ?? "?",
        dotColor: match?.dotColor ?? "linear-gradient(135deg,#888,#bbb)",
        short: short(addr),
        value: fmtNum(val) + " " + (match?.confSymbol ?? "cTKN"),
        handle,
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      });
      showToast("🔓", "var(--violet)", "Decryption complete", (match?.confSymbol ?? "Token") + " balance revealed");
    } catch (e) {
      showToast("!", "var(--bad)", "Decryption failed", e instanceof Error ? e.message.slice(0, 60) : "Error");
    } finally {
      setArbBusy(false);
    }
  };

  // ---------- faucet ----------
  const faucet = (id: string) => async () => {
    if (faucetBusy[id] || faucetDone[id]) return;
    const p = byId(id);
    if (!p || !walletClient || !publicClient || !address) return;
    if (wrongNetwork) {
      switchChain({ chainId: sepolia.id });
      return;
    }
    setFaucetBusy((s) => ({ ...s, [id]: true }));
    try {
      const tx = await walletClient.writeContract({
        address: p.tokenAddress, abi: ERC20_MOCK_ABI, functionName: "mint",
        args: [address, parseUnits("1000", p.decimals ?? 18)],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setFaucetDone((s) => ({ ...s, [id]: true }));
      showToast("✓", "var(--good)", `Claimed 1,000 ${p.symbol}`, "Sent to " + short(address));
      loadBalances();
      setTimeout(() => setFaucetDone((s) => ({ ...s, [id]: false })), 4000);
    } catch (e) {
      showToast("!", "var(--bad)", "Faucet failed", e instanceof Error ? e.message.slice(0, 60) : "Error");
    } finally {
      setFaucetBusy((s) => ({ ...s, [id]: false }));
    }
  };

  // ---------- derived ----------
  const wrapPair = byId(wrapPairId) ?? pairs[0];
  const isWrap = wrapMode === "wrap";
  const fromSym = wrapPair ? (isWrap ? wrapPair.symbol : wrapPair.confSymbol) : "";
  const toSym = wrapPair ? (isWrap ? wrapPair.confSymbol : wrapPair.symbol) : "";
  const wrapDecimals = wrapPair?.decimals ?? 18;
  const fromBal = wrapPair
    ? isWrap
      ? Number(formatUnits(erc20Bal[wrapPairId] ?? BigInt(0), wrapDecimals))
      : decryptedVal[wrapPairId] ?? 0
    : 0;
  const amtNum = parseFloat(amount) || 0;
  const wrappedCount = useMemo(
    () => Object.keys(decryptedVal).filter((k) => decryptedVal[k] > 0).length,
    [decryptedVal]
  );

  const shortAddr = address ? short(address) : "";
  const themeIcon = theme === "dark" ? "☀" : "☾";

  // shared style helpers
  const accentInk = "var(--accent-ink)";

  const tabsDef: { id: Tab; label: string; icon: string }[] = [
    { id: "registry", label: "Registry", icon: "▦" },
    { id: "wrap", label: "Wrap", icon: "⇄" },
    { id: "decrypt", label: "Decrypt", icon: "🔓" },
    { id: "faucet", label: "Faucet", icon: "⛲" },
  ];

  const stepDefs = [
    { idx: 1, label: isWrap ? "Approve " + (wrapPair?.symbol ?? "") : "Allowance" },
    { idx: 2, label: isWrap ? "Wrap" : "Unwrap" },
    { idx: 3, label: "Confirmed" },
  ];
  const confirmLabelMap: Record<number, string> = {
    0: (isWrap ? "Wrap " : "Unwrap ") + (fromSym ?? ""),
    1: isWrap ? `Approving ${wrapPair?.symbol}…` : "Setting allowance…",
    2: isWrap ? "Wrapping…" : "Unwrapping…",
    3: "Done ✓",
  };
  const canConfirm = amtNum > 0 && wrapStep === 0;

  return (
    <div
      data-theme={theme}
      data-accent={accent === "gold" ? undefined : accent}
      style={{
        position: "relative",
        minHeight: "100vh",
        width: "100%",
        background: "var(--bg)",
        color: "var(--text)",
        fontFamily: "'Instrument Sans', sans-serif",
        transition: "background .5s ease, color .5s ease",
      }}
    >
      <VeilCanvas screen={screen} heroRef={heroRef} chipsRef={chipsRef} />

      {/* ===================== LANDING ===================== */}
      {screen === "landing" && (
        <div style={{ position: "relative", zIndex: 2, minHeight: "100vh", overflow: "hidden" }}>
          {/* nav */}
          <div style={{ position: "relative", zIndex: 4, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 36px", maxWidth: 1280, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: "#16151d", border: "1px solid rgba(255,255,255,.09)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 13, height: 13, borderRadius: 4, background: "#FFD60A", boxShadow: "0 0 14px rgba(255,214,10,.7)" }} />
              </div>
              <span style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 19, letterSpacing: "-.01em", color: "#f4f3f8" }}>VEIL</span>
              <span style={{ fontSize: 12, color: "#7d7b8c", fontWeight: 500, marginTop: 2 }}>Confidential Wrapper Registry</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 99, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", fontSize: 12.5, color: "#a3a1b2", fontWeight: 500, fontFamily: "'JetBrains Mono'" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "oklch(0.78 0.16 150)", boxShadow: "0 0 8px oklch(0.78 0.16 150)" }} />Sepolia
              </span>
              <button onClick={openConnectModal} className="veil-hover-bright" style={{ padding: "10px 18px", borderRadius: 11, border: "none", cursor: "pointer", fontFamily: "'Instrument Sans'", fontSize: 14, fontWeight: 600, color: "#1a1407", background: "#FFD60A", transition: "filter .2s" }}>Connect</button>
            </div>
          </div>

          {/* floating coins */}
          <div ref={chipsRef} style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none", transition: "transform .25s ease-out", willChange: "transform" }}>
            <div style={{ position: "absolute", left: "11%", top: "22%", width: 54, height: 54, borderRadius: "50%", background: "radial-gradient(circle at 32% 28%,#ffe19a,#d99a1e)", boxShadow: "0 16px 34px rgba(0,0,0,.55),inset 0 2px 5px rgba(255,255,255,.4),inset 0 -7px 12px rgba(0,0,0,.3)", border: "1px solid rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 20, color: "#fff", opacity: 0.5, filter: "blur(.5px)", animation: "floaty 8s ease-in-out -0.5s infinite" }}>◈</div>
            <div style={{ position: "absolute", left: "85%", top: "66%", width: 46, height: 46, borderRadius: "50%", background: "radial-gradient(circle at 32% 28%,#a9b8ff,#4a63d8)", boxShadow: "0 14px 30px rgba(0,0,0,.55),inset 0 2px 4px rgba(255,255,255,.4),inset 0 -6px 10px rgba(0,0,0,.3)", border: "1px solid rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 17, color: "#fff", opacity: 0.5, filter: "blur(1px)", animation: "floaty 9.5s ease-in-out -2s infinite" }}>Ξ</div>
            <div style={{ position: "absolute", left: "16%", top: "78%", width: 40, height: 40, borderRadius: "50%", background: "radial-gradient(circle at 32% 28%,#7fb4ff,#2775CA)", boxShadow: "0 12px 26px rgba(0,0,0,.55),inset 0 2px 4px rgba(255,255,255,.38)", border: "1px solid rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 15, color: "#fff", opacity: 0.45, filter: "blur(1.5px)", animation: "floaty 8.5s ease-in-out -4s infinite" }}>$</div>
          </div>

          {/* hero */}
          <div style={{ position: "relative", zIndex: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: "82vh", padding: "1vh 24px 5vh" }}>
            <div ref={heroRef} style={{ position: "relative", maxWidth: 790, transition: "transform .25s ease-out", willChange: "transform" }}>
              <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "150%", height: "215%", background: "radial-gradient(closest-side, rgba(8,9,16,.84), rgba(8,9,16,.45) 52%, transparent 76%)", zIndex: -1 }} />
              <div style={{ display: "inline-flex", alignItems: "center", gap: 9, marginBottom: 24, fontFamily: "'JetBrains Mono'", fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: "oklch(0.84 0.13 174)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "oklch(0.84 0.13 174)", boxShadow: "0 0 10px oklch(0.84 0.13 174)" }} />
                Zama Wrappers Registry · FHE
              </div>
              <h1 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: "clamp(40px,6.2vw,82px)", lineHeight: 1, letterSpacing: "-.035em", color: "#f4f4f8", marginBottom: 22, textWrap: "balance" }}>
                Decrypt only what<br />you <span style={{ color: "oklch(0.85 0.15 172)" }}>choose to see.</span>
              </h1>
              <p style={{ fontSize: "clamp(15px,1.6vw,18.5px)", lineHeight: 1.6, color: "#a6a6b8", maxWidth: "52ch", margin: "0 auto 32px" }}>
                Every official ERC-20 ↔ ERC-7984 wrapper on Sepolia, in one registry. Balances stay encrypted on-chain — sweep your cursor to decrypt the field, then connect to wrap, unwrap, and reveal your own.
              </p>
              <div style={{ display: "flex", gap: 13, alignItems: "center", justifyContent: "center", flexWrap: "wrap", marginBottom: 28 }}>
                <button onClick={openConnectModal} className="veil-cta" style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "15px 28px", borderRadius: 13, border: "none", cursor: "pointer", fontFamily: "'Instrument Sans'", fontSize: 15.5, fontWeight: 600, color: "#1a1407", background: "#FFD60A", boxShadow: "0 14px 40px rgba(255,214,10,.22)", transition: "transform .2s, box-shadow .2s" }}>
                  Connect wallet <span style={{ fontSize: 17, lineHeight: 1 }}>→</span>
                </button>
                <button onClick={openConnectModal} className="veil-hover-white05" style={{ padding: "15px 24px", borderRadius: 13, cursor: "pointer", fontFamily: "'Instrument Sans'", fontSize: 15.5, fontWeight: 500, color: "#e8e7ef", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.14)", transition: "background .2s" }}>Browse the registry</button>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: "'JetBrains Mono'", fontSize: 11.5, letterSpacing: ".04em", color: "#7a7a8e" }}>
                <span style={{ width: 16, height: 16, borderRadius: "50%", border: "1.5px solid oklch(0.8 0.13 174)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "oklch(0.84 0.13 174)" }}>◎</span>
                move your cursor to decrypt the registry
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== APP ===================== */}
      {screen === "app" && (
        <div className="veil-scroll" style={{ position: "relative", zIndex: 2, minHeight: "100vh" }}>
          <div style={{ position: "absolute", inset: 0, zIndex: 0, background: "radial-gradient(80% 50% at 50% -10%, var(--violet-dim), transparent 70%)" }} />

          {/* topbar */}
          <header style={{ position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 26px", background: "color-mix(in oklch, var(--bg) 78%, transparent)", backdropFilter: "blur(18px)", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)" }}>
                <div style={{ width: 12, height: 12, borderRadius: 4, background: "linear-gradient(135deg,var(--accent),var(--violet))" }} />
              </div>
              <span style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 17, letterSpacing: "-.01em" }}>VEIL</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 6, padding: "5px 10px", borderRadius: 99, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 11.5, color: "var(--muted)", fontWeight: 500 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: wrongNetwork ? "var(--bad)" : "var(--good)", boxShadow: `0 0 8px ${wrongNetwork ? "var(--bad)" : "var(--good)"}` }} />
                {wrongNetwork ? "Wrong network" : "Sepolia"}
              </span>
            </div>

            <nav style={{ display: "flex", gap: 4, padding: 4, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)" }}>
              {tabsDef.map((t) => (
                <button key={t.id} onClick={() => { setTab(t.id); setWrapStep(0); }} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "'Instrument Sans'", fontSize: 13.5, fontWeight: 600, color: tab === t.id ? accentInk : "var(--muted)", background: tab === t.id ? "var(--accent)" : "transparent", transition: "all .2s" }}>
                  <span style={{ fontSize: 14, opacity: 0.85 }}>{t.icon}</span>{t.label}
                </button>
              ))}
            </nav>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {wrongNetwork && (
                <button onClick={() => switchChain({ chainId: sepolia.id })} style={{ padding: "8px 13px", borderRadius: 11, cursor: "pointer", border: "1px solid var(--bad)", background: "transparent", color: "var(--bad)", fontFamily: "'Instrument Sans'", fontWeight: 600, fontSize: 13 }}>Switch to Sepolia</button>
              )}
              <button onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} title="Toggle theme" className="veil-hover-border" style={{ width: 38, height: 38, borderRadius: 11, cursor: "pointer", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s" }}>{themeIcon}</button>
              <button onClick={() => disconnect()} className="veil-hover-border" style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 9px 8px 13px", borderRadius: 11, cursor: "pointer", border: "1px solid var(--border)", background: "var(--surface)", transition: "border-color .2s" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--good)", boxShadow: "0 0 8px var(--good)" }} />
                <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 12.5, fontWeight: 500, color: "var(--text)" }}>{shortAddr}</span>
                <span style={{ width: 24, height: 24, borderRadius: 7, background: "linear-gradient(135deg,var(--accent),var(--violet))" }} />
              </button>
            </div>
          </header>

          <main style={{ maxWidth: 1080, margin: "0 auto", padding: "34px 26px 80px" }}>
            {/* ---------- REGISTRY ---------- */}
            {tab === "registry" && (
              <div style={{ animation: "riseIn .4s ease both" }}>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 24, flexWrap: "wrap" }}>
                  <div>
                    <h1 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 32, letterSpacing: "-.02em", marginBottom: 6 }}>Wrapper registry</h1>
                    <p style={{ color: "var(--muted)", fontSize: 15, maxWidth: "56ch" }}>Sourced live from the onchain Zama Wrappers Registry on Sepolia, extended with local dev pairs. Each pair maps a public ERC-20 to its confidential ERC-7984 twin.</p>
                  </div>
                  <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 11, background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <button onClick={() => setViewMode("cards")} style={{ padding: "8px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Instrument Sans'", color: viewMode === "cards" ? "var(--text)" : "var(--muted)", background: viewMode === "cards" ? "var(--surface2)" : "transparent", transition: "all .2s" }}>▦ Cards</button>
                    <button onClick={() => setViewMode("table")} style={{ padding: "8px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Instrument Sans'", color: viewMode === "table" ? "var(--text)" : "var(--muted)", background: viewMode === "table" ? "var(--surface2)" : "transparent", transition: "all .2s" }}>≣ Table</button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, marginBottom: 26, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 150, padding: "16px 18px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" }}><div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 7 }}>Official pairs</div><div style={{ fontFamily: "'Space Grotesk'", fontWeight: 600, fontSize: 26 }}>{pairs.length}</div></div>
                  <div style={{ flex: 1, minWidth: 150, padding: "16px 18px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" }}><div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 7 }}>Your revealed tokens</div><div style={{ fontFamily: "'Space Grotesk'", fontWeight: 600, fontSize: 26, display: "flex", alignItems: "center", gap: 8 }}>{wrappedCount}<span style={{ fontSize: 13, color: "var(--violet)", fontWeight: 500 }}>confidential</span></div></div>
                  <div style={{ flex: 1, minWidth: 150, padding: "16px 18px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" }}><div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 7 }}>Registry source</div><div style={{ fontFamily: "'JetBrains Mono'", fontWeight: 500, fontSize: 13, color: "var(--text)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--good)" }} />{registrySource}</div></div>
                </div>

                {viewMode === "cards" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(330px,1fr))", gap: 14 }}>
                    {pairs.map((p) => {
                      const id = idOf(p);
                      const isDec = !!decrypted[id];
                      const isDecing = !!decrypting[id];
                      const erc20Fmt = fmtNum(Number(formatUnits(erc20Bal[id] ?? BigInt(0), p.decimals ?? 18))) + " " + p.symbol;
                      const confFmt = fmtNum(decryptedVal[id] ?? 0) + " " + p.confSymbol;
                      return (
                        <div key={id} className="veil-hover-lift" style={{ padding: 18, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--border)", transition: "border-color .2s, transform .2s", animation: "popIn .35s ease both" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                              <div style={{ width: 42, height: 42, borderRadius: 13, background: p.dotColor, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 14, color: "#fff" }}>{p.glyph}</div>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: "'Space Grotesk'", fontWeight: 600, fontSize: 16 }}>{p.confSymbol}<span style={{ fontSize: 11, color: "var(--violet)", background: "var(--violet-dim)", padding: "2px 7px", borderRadius: 6, fontFamily: "'Instrument Sans'", fontWeight: 600 }}>ERC-7984</span></div>
                                <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{p.name}</div>
                              </div>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--faint)", fontFamily: "'JetBrains Mono'" }}>{p.decimals} dec</div>
                          </div>

                          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                            <div style={{ flex: 1, padding: "10px 12px", borderRadius: 11, background: "var(--bg2)", border: "1px solid var(--border)" }}>
                              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 5 }}>ERC-20 (public)</div>
                              <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, color: "var(--text)", marginBottom: 2 }}>{erc20Fmt}</div>
                              <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 10.5, color: "var(--faint)" }}>{short(p.tokenAddress)}</div>
                            </div>
                            <div style={{ flex: 1, padding: "10px 12px", borderRadius: 11, background: "var(--violet-dim)", border: "1px solid color-mix(in oklch, var(--violet) 30%, transparent)" }}>
                              <div style={{ fontSize: 11, color: "var(--violet)", marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>🔒 ERC-7984</div>
                              {isDec ? (
                                <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, color: "var(--text)", marginBottom: 2, animation: "sharpen .7s ease both" }}>{confFmt}</div>
                              ) : (
                                <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, color: "var(--violet)", marginBottom: 2, filter: "blur(4px)", userSelect: "none", animation: "shimmer 2.4s ease-in-out infinite" }}>{cipherFor(id)}</div>
                              )}
                              <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 10.5, color: "var(--faint)" }}>{short(p.confidentialTokenAddress)}</div>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={goWrap(id, "wrap")} className="veil-hover-bright6" style={{ flex: 1, padding: 10, borderRadius: 11, border: "none", cursor: "pointer", fontFamily: "'Instrument Sans'", fontWeight: 600, fontSize: 13, color: accentInk, background: "var(--accent)", transition: "filter .2s" }}>Wrap →</button>
                            <button onClick={goWrap(id, "unwrap")} className="veil-hover-border" style={{ flex: 1, padding: 10, borderRadius: 11, cursor: "pointer", fontFamily: "'Instrument Sans'", fontWeight: 600, fontSize: 13, color: "var(--text)", background: "var(--surface2)", border: "1px solid var(--border)", transition: "border-color .2s" }}>← Unwrap</button>
                            {!isDec ? (
                              <button onClick={decrypt(id)} title="Decrypt balance" style={{ width: 42, padding: 10, borderRadius: 11, cursor: "pointer", border: "1px solid color-mix(in oklch, var(--violet) 40%, transparent)", background: "var(--violet-dim)", color: "var(--violet)", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s" }}>
                                {isDecing ? <span style={{ width: 14, height: 14, border: "2px solid var(--violet)", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} /> : <span>🔓</span>}
                              </button>
                            ) : (
                              <div style={{ width: 42, borderRadius: 11, background: "color-mix(in oklch, var(--good) 18%, transparent)", color: "var(--good)", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {viewMode === "table" && (
                  <div style={{ borderRadius: 18, border: "1px solid var(--border)", overflow: "hidden", background: "var(--surface)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.1fr 1.1fr 1.3fr", gap: 12, padding: "13px 18px", background: "var(--bg2)", fontSize: 11.5, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", borderBottom: "1px solid var(--border)" }}>
                      <span>Token</span><span>ERC-20 balance</span><span>Confidential</span><span>Addresses</span><span style={{ textAlign: "right" }}>Actions</span>
                    </div>
                    {pairs.map((p) => {
                      const id = idOf(p);
                      const isDec = !!decrypted[id];
                      const isDecing = !!decrypting[id];
                      const erc20Fmt = fmtNum(Number(formatUnits(erc20Bal[id] ?? BigInt(0), p.decimals ?? 18))) + " " + p.symbol;
                      const confFmt = fmtNum(decryptedVal[id] ?? 0) + " " + p.confSymbol;
                      return (
                        <div key={id} className="veil-hover-row" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.1fr 1.1fr 1.3fr", gap: 12, padding: "14px 18px", alignItems: "center", borderBottom: "1px solid var(--border)", transition: "background .15s" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: p.dotColor, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 12, color: "#fff" }}>{p.glyph}</div>
                            <div><div style={{ fontFamily: "'Space Grotesk'", fontWeight: 600, fontSize: 14 }}>{p.confSymbol}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>{p.name}</div></div>
                          </div>
                          <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 13 }}>{erc20Fmt}</div>
                          <div>
                            {isDec ? (
                              <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, color: "var(--violet)", animation: "sharpen .7s ease both" }}>{confFmt}</span>
                            ) : (
                              <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, color: "var(--violet)", filter: "blur(4px)", userSelect: "none" }}>••{id.slice(2, 5)}••</span>
                            )}
                          </div>
                          <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 11, color: "var(--faint)", lineHeight: 1.5 }}>{short(p.tokenAddress)}<br />{short(p.confidentialTokenAddress)}</div>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button onClick={goWrap(id, "wrap")} style={{ padding: "7px 11px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "'Instrument Sans'", fontWeight: 600, fontSize: 12, color: accentInk, background: "var(--accent)" }}>Wrap</button>
                            {!isDec ? (
                              <button onClick={decrypt(id)} style={{ padding: "7px 9px", borderRadius: 9, cursor: "pointer", border: "1px solid color-mix(in oklch, var(--violet) 40%, transparent)", background: "var(--violet-dim)", color: "var(--violet)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 32 }}>
                                {isDecing ? <span style={{ width: 12, height: 12, border: "2px solid var(--violet)", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} /> : <span>🔓</span>}
                              </button>
                            ) : (
                              <span style={{ padding: "7px 9px", color: "var(--good)", fontSize: 13 }}>✓</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ---------- WRAP / UNWRAP ---------- */}
            {tab === "wrap" && wrapPair && (
              <div style={{ animation: "riseIn .4s ease both", maxWidth: 560, margin: "0 auto" }}>
                <h1 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 32, letterSpacing: "-.02em", marginBottom: 6, textAlign: "center" }}>{isWrap ? "Wrap into confidential" : "Unwrap to public"}</h1>
                <p style={{ color: "var(--muted)", fontSize: 15, textAlign: "center", marginBottom: 26 }}>{isWrap ? "Convert a public ERC-20 into its encrypted ERC-7984 twin." : "Convert a confidential ERC-7984 back into its public ERC-20."}</p>

                <div style={{ display: "flex", gap: 6, padding: 5, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 18 }}>
                  <button onClick={() => { setWrapMode("wrap"); setWrapStep(0); }} style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "'Instrument Sans'", fontWeight: 600, fontSize: 14, color: isWrap ? "var(--text)" : "var(--muted)", background: isWrap ? "var(--surface2)" : "transparent", transition: "all .2s" }}>Wrap → confidential</button>
                  <button onClick={() => { setWrapMode("unwrap"); setWrapStep(0); }} style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "'Instrument Sans'", fontWeight: 600, fontSize: 14, color: !isWrap ? "var(--text)" : "var(--muted)", background: !isWrap ? "var(--surface2)" : "transparent", transition: "all .2s" }}>Unwrap → public</button>
                </div>

                <div style={{ padding: 22, borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10, fontWeight: 500 }}>Select token</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                    {pairs.map((p) => {
                      const id = idOf(p);
                      const sel = wrapPairId === id;
                      return (
                        <button key={id} onClick={() => { setWrapPairId(id); setWrapStep(0); }} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 99, cursor: "pointer", fontFamily: "'Instrument Sans'", fontWeight: 600, fontSize: 13, color: sel ? "var(--text)" : "var(--muted)", background: sel ? "var(--surface2)" : "transparent", border: `1px solid ${sel ? "var(--border2)" : "var(--border)"}`, transition: "all .2s" }}>
                          <span style={{ width: 18, height: 18, borderRadius: 6, background: p.dotColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontFamily: "'Space Grotesk'", fontWeight: 700 }}>{p.glyph}</span>{p.confSymbol}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ padding: 16, borderRadius: 14, background: "var(--bg2)", border: "1px solid var(--border)", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
                      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>You send · {isWrap ? "public" : "confidential"}</span>
                      <span style={{ fontSize: 12, color: "var(--faint)", fontFamily: "'JetBrains Mono'" }}>balance {fmtNum(fromBal)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setWrapStep(0); }} placeholder="0.0" inputMode="decimal" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontFamily: "'JetBrains Mono'", fontSize: 28, fontWeight: 500, color: "var(--text)", minWidth: 0 }} />
                      <button onClick={onMax} style={{ padding: "6px 11px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--border2)", background: "transparent", color: "var(--accent)", fontWeight: 600, fontSize: 12, fontFamily: "'Instrument Sans'" }}>MAX</button>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 99, background: "var(--surface)", border: "1px solid var(--border)" }}><span style={{ width: 20, height: 20, borderRadius: 6, background: wrapPair.dotColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontFamily: "'Space Grotesk'", fontWeight: 700 }}>{wrapPair.glyph}</span><span style={{ fontWeight: 600, fontSize: 14, fontFamily: "'Space Grotesk'" }}>{fromSym}</span></div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "center", margin: "-4px 0", position: "relative", zIndex: 2 }}><div style={{ width: 34, height: 34, borderRadius: 11, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 16 }}>↓</div></div>

                  <div style={{ padding: 16, borderRadius: 14, background: "var(--violet-dim)", border: "1px solid color-mix(in oklch, var(--violet) 25%, transparent)", marginBottom: 18, marginTop: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
                      <span style={{ fontSize: 12.5, color: "var(--violet)" }}>You receive · {isWrap ? "confidential" : "public"}</span>
                      <span style={{ fontSize: 12, color: "var(--faint)", fontFamily: "'JetBrains Mono'" }}>{isWrap ? "🔒 hidden after wrap" : "visible onchain"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, fontFamily: "'JetBrains Mono'", fontSize: 28, fontWeight: 500, color: amtNum > 0 ? "var(--text)" : "var(--faint)" }}>{amtNum > 0 ? fmtNum(amtNum) : "0.0"}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 99, background: "var(--surface)", border: "1px solid var(--border)" }}><span style={{ fontSize: 13 }}>🔒</span><span style={{ fontWeight: 600, fontSize: 14, fontFamily: "'Space Grotesk'" }}>{toSym}</span></div>
                    </div>
                  </div>

                  {wrapStep > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 16px", borderRadius: 13, background: "var(--bg2)", border: "1px solid var(--border)", marginBottom: 14 }}>
                      {stepDefs.map((st) => {
                        const isDone = wrapStep > st.idx;
                        const busy = wrapStep === st.idx && st.idx < 3;
                        const active = wrapStep >= st.idx;
                        const finalDone = st.idx === 3 && wrapStep === 3;
                        return (
                          <div key={st.idx} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                            <div style={{ width: 26, height: 26, borderRadius: 8, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, fontFamily: "'Space Grotesk'", color: active ? accentInk : "var(--muted)", background: active ? "var(--accent)" : "var(--surface2)", border: `1px solid ${active ? "var(--accent)" : "var(--border)"}` }}>
                              {busy ? <span style={{ width: 12, height: 12, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} /> : <span>{isDone || finalDone ? "✓" : String(st.idx)}</span>}
                            </div>
                            <span style={{ fontSize: 12.5, fontWeight: 500, color: active ? "var(--text)" : "var(--muted)" }}>{st.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button onClick={confirmWrap} disabled={!canConfirm} style={{ width: "100%", padding: 15, borderRadius: 13, border: "none", cursor: canConfirm ? "pointer" : "default", fontFamily: "'Instrument Sans'", fontWeight: 600, fontSize: 15, color: accentInk, background: wrapStep === 3 ? "var(--good)" : "var(--accent)", opacity: canConfirm || wrapStep > 0 ? 1 : 0.5, transition: "all .2s" }}>{confirmLabelMap[wrapStep]}</button>
                </div>
              </div>
            )}

            {/* ---------- DECRYPT ---------- */}
            {tab === "decrypt" && (
              <div style={{ animation: "riseIn .4s ease both", maxWidth: 620, margin: "0 auto" }}>
                <h1 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 32, letterSpacing: "-.02em", marginBottom: 6, textAlign: "center" }}>Decrypt a balance</h1>
                <p style={{ color: "var(--muted)", fontSize: 15, textAlign: "center", marginBottom: 26 }}>Sign an EIP-712 request to reveal the plaintext of any ERC-7984 balance you own — including tokens outside the registry. Nothing is revealed onchain.</p>

                <div style={{ padding: 22, borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 16 }}>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10, fontWeight: 500 }}>ERC-7984 token address</div>
                  <div style={{ display: "flex", gap: 9, marginBottom: 14 }}>
                    <input value={arbAddr} onChange={(e) => { setArbAddr(e.target.value); setArbResult(null); }} placeholder="0x… any confidential token" className="veil-focus-violet" style={{ flex: 1, padding: "13px 14px", borderRadius: 12, background: "var(--bg2)", border: "1px solid var(--border)", outline: "none", fontFamily: "'JetBrains Mono'", fontSize: 13, color: "var(--text)" }} />
                    <button onClick={arbDecrypt} disabled={arbBusy || arbAddr.trim().length < 6} style={{ padding: "13px 20px", borderRadius: 12, border: "none", cursor: arbBusy || arbAddr.trim().length < 6 ? "default" : "pointer", fontFamily: "'Instrument Sans'", fontWeight: 600, fontSize: 14, color: "#fff", background: "var(--violet)", opacity: arbBusy || arbAddr.trim().length < 6 ? 0.55 : 1, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", transition: "all .2s" }}>
                      {arbBusy ? <><span style={{ width: 14, height: 14, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />Signing…</> : "🔓 Decrypt"}
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "var(--faint)", alignSelf: "center" }}>Quick fill:</span>
                    {pairs.slice(0, 4).map((p) => (
                      <button key={idOf(p)} onClick={() => { setArbAddr(p.confidentialTokenAddress); setArbResult(null); }} className="veil-hover-border" style={{ padding: "5px 10px", borderRadius: 7, cursor: "pointer", border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--muted)", fontSize: 11.5, fontFamily: "'JetBrains Mono'" }}>{p.confSymbol}</button>
                    ))}
                  </div>
                </div>

                {arbResult && (
                  <div style={{ padding: 24, borderRadius: 20, background: "linear-gradient(160deg,var(--violet-dim),var(--surface))", border: "1px solid color-mix(in oklch, var(--violet) 30%, transparent)", animation: "popIn .4s ease both" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: arbResult.dotColor, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 13, color: "#fff" }}>{arbResult.glyph}</div>
                        <div><div style={{ fontFamily: "'Space Grotesk'", fontWeight: 600, fontSize: 16 }}>{arbResult.sym}</div><div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "'JetBrains Mono'" }}>{arbResult.short}</div></div>
                      </div>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--good)", background: "color-mix(in oklch, var(--good) 16%, transparent)", padding: "6px 11px", borderRadius: 99, fontWeight: 600 }}>✓ Decrypted</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>Plaintext balance · revealed only to you</div>
                    <div style={{ fontFamily: "'JetBrains Mono'", fontWeight: 600, fontSize: 38, color: "var(--text)", animation: "sharpen .8s ease both" }}>{arbResult.value}</div>
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", fontSize: 11.5, color: "var(--faint)", fontFamily: "'JetBrains Mono'", lineHeight: 1.6 }}>handle: {arbResult.handle}<br />EIP-712 signature verified · relayer SDK · {arbResult.time}</div>
                  </div>
                )}
              </div>
            )}

            {/* ---------- FAUCET ---------- */}
            {tab === "faucet" && (
              <div style={{ animation: "riseIn .4s ease both", maxWidth: 760, margin: "0 auto" }}>
                <h1 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 32, letterSpacing: "-.02em", marginBottom: 6, textAlign: "center" }}>Sepolia faucet</h1>
                <p style={{ color: "var(--muted)", fontSize: 15, textAlign: "center", marginBottom: 26 }}>Claim the official cTokenMock test tokens from the Sepolia Wrappers Registry, then wrap them into their confidential form.</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 13 }}>
                  {pairs.map((p) => {
                    const id = idOf(p);
                    const fBusy = !!faucetBusy[id];
                    const fDone = !!faucetDone[id];
                    return (
                      <div key={id} style={{ padding: 18, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 12, background: p.dotColor, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 13, color: "#fff" }}>{p.glyph}</div>
                          <div><div style={{ fontFamily: "'Space Grotesk'", fontWeight: 600, fontSize: 15 }}>{p.symbol}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>{p.name}</div></div>
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>Drips</span>
                          <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 14, color: "var(--text)" }}>1,000 {p.symbol}</span>
                        </div>
                        <button onClick={faucet(id)} disabled={fBusy || fDone} style={{ width: "100%", padding: 11, borderRadius: 11, border: `1px solid ${fDone ? "color-mix(in oklch, var(--good) 40%, transparent)" : "transparent"}`, cursor: fBusy || fDone ? "default" : "pointer", fontFamily: "'Instrument Sans'", fontWeight: 600, fontSize: 13.5, color: fDone ? "var(--good)" : fBusy ? "var(--muted)" : accentInk, background: fDone ? "transparent" : fBusy ? "var(--surface2)" : "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "all .2s" }}>
                          {fBusy ? <><span style={{ width: 13, height: 13, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />Claiming…</> : fDone ? "✓ Claimed" : "Claim tokens"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)", zIndex: 60, display: "flex", alignItems: "center", gap: 11, padding: "13px 18px", borderRadius: 14, background: "var(--surface2)", border: "1px solid var(--border2)", boxShadow: "0 18px 50px oklch(0 0 0 / .4)", animation: "popIn .3s ease both", maxWidth: "90vw" }}>
          <span style={{ width: 24, height: 24, borderRadius: 8, background: toast.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flex: "none" }}>{toast.icon}</span>
          <div><div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{toast.title}</div><div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "'JetBrains Mono'" }}>{toast.sub}</div></div>
        </div>
      )}
    </div>
  );
}
