"use client";
import { useState } from "react";
import Link from "next/link";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "registry", label: "Registry" },
  { id: "faucet", label: "Faucet" },
  { id: "wrap", label: "Wrap" },
  { id: "unwrap", label: "Unwrap" },
  { id: "decrypt", label: "Decrypt" },
  { id: "fhe", label: "How FHE works" },
  { id: "contracts", label: "Contracts" },
];

export default function DocsPage() {
  const [active, setActive] = useState("overview");

  const scrollTo = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0e0d14", color: "#f4f3f8", fontFamily: "'Instrument Sans', sans-serif" }}>
      {/* topbar */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, borderBottom: "1px solid #1e1d2a", background: "rgba(14,13,20,.85)", backdropFilter: "blur(16px)", padding: "14px 32px", display: "flex", alignItems: "center", gap: 14 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "#16151f", border: "1px solid #2a2938", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 11, height: 11, borderRadius: 3, background: "#FFD60A" }} />
          </div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: "#f4f3f8" }}>VEIL</span>
        </Link>
        <span style={{ color: "#3a3848", fontSize: 16 }}>/</span>
        <span style={{ fontSize: 14, color: "#888", fontWeight: 500 }}>Documentation</span>
        <Link href="/" style={{ marginLeft: "auto", padding: "7px 14px", borderRadius: 9, border: "1px solid #2a2938", background: "transparent", color: "#aaa", fontSize: 13, fontWeight: 600, textDecoration: "none", fontFamily: "'Instrument Sans', sans-serif" }}>← Back to app</Link>
      </div>

      <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        {/* sidebar */}
        <aside style={{ width: 200, flexShrink: 0, position: "sticky", top: 80, alignSelf: "flex-start", marginRight: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#555", marginBottom: 12 }}>Contents</div>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => scrollTo(s.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: active === s.id ? 600 : 400, color: active === s.id ? "#FFD60A" : "#888", background: active === s.id ? "rgba(255,214,10,.08)" : "transparent", fontFamily: "'Instrument Sans', sans-serif", marginBottom: 2, transition: "all .15s" }}>
              {s.label}
            </button>
          ))}
        </aside>

        {/* content */}
        <main style={{ flex: 1, minWidth: 0 }}>

          <Section id="overview" title="What is VEIL?">
            <P>VEIL is a front-end for Zama&apos;s official <B>Confidential Wrapper Registry</B> on Ethereum Sepolia. It lets you wrap standard ERC-20 tokens into their encrypted ERC-7984 equivalents — where balances are hidden on-chain using Fully Homomorphic Encryption (FHE).</P>
            <P>Nobody — not even the chain — can read your balance. Only you can decrypt it, using your wallet signature.</P>
            <Cards items={[
              { icon: "▦", title: "Registry", desc: "Browse all 8 official ERC-20 ↔ ERC-7984 pairs registered by Zama on Sepolia." },
              { icon: "⇄", title: "Wrap / Unwrap", desc: "Convert public tokens to confidential and back. Balances disappear on wrap." },
              { icon: "🔓", title: "Decrypt", desc: "Reveal your own encrypted balance using an EIP-712 signature — nothing is exposed on-chain." },
              { icon: "⛲", title: "Faucet", desc: "Mint 1,000 test tokens of any pair instantly — no real funds needed." },
            ]} />
          </Section>

          <Section id="registry" title="Registry">
            <P>The registry reads live from the onchain <Code>WrappersRegistry</Code> contract at <Code>0x2f0750…128e</Code> on Sepolia. It returns all valid ERC-20 ↔ ERC-7984 token pairs registered by Zama.</P>
            <P>Each pair shows:</P>
            <ul style={{ paddingLeft: 20, color: "#aaa", lineHeight: 2, fontSize: 14 }}>
              <li><B>ERC-20 balance</B> — your public token balance, visible to anyone</li>
              <li><B>ERC-7984 balance</B> — your confidential balance, shown as <Code>••···••</Code> until you decrypt</li>
              <li><B>Decimals → conf decimals</B> — e.g. WETH is 18-decimal but cWETH is 6-decimal (capped by the wrapper)</li>
              <li><B>Rate</B> — the base-unit conversion factor (e.g. rate 10^12 means 1 WETH = 10^12 base units of underlying, but still 1 cWETH)</li>
            </ul>
            <Callout>Switch between <B>Cards</B> and <B>Table</B> view using the toggle in the top right of the registry tab.</Callout>
          </Section>

          <Section id="faucet" title="Faucet">
            <P>Each of the 8 pairs has a mock underlying ERC-20 with a public <Code>mint(address, amount)</Code> function. The faucet calls this to send 1,000 tokens directly to your wallet.</P>
            <Steps items={[
              "Connect your wallet on Sepolia",
              "Go to the Faucet tab",
              "Click Claim tokens on any pair",
              "Approve the transaction in MetaMask",
              "1,000 tokens land in your wallet — check the Registry tab to see your updated balance",
            ]} />
            <Callout type="info">You need Sepolia ETH for gas. Get some free at <a href="https://sepoliafaucet.com" target="_blank" rel="noopener noreferrer" style={{ color: "#FFD60A" }}>sepoliafaucet.com</a>.</Callout>
          </Section>

          <Section id="wrap" title="Wrapping (ERC-20 → ERC-7984)">
            <P>Wrapping locks your public ERC-20 tokens in the wrapper contract and mints an equivalent amount of encrypted ERC-7984 tokens to your address. After wrapping, your confidential balance is hidden — no one can see it.</P>
            <Steps items={[
              "Select a token and enter an amount",
              "Click Wrap — MetaMask will ask you to Approve (lets the wrapper pull your tokens)",
              "After approval confirms, MetaMask asks you to confirm the Wrap transaction",
              "Done — your ERC-20 balance decreases, your confidential balance increases (but stays hidden)",
            ]} />
            <Callout type="warning">The wrap amount is in <B>underlying decimals</B>. The wrapper internally divides by <Code>rate()</Code> to calculate your confidential units. For WETH (rate 10^12): wrapping 1 WETH gives you 1 cWETH.</Callout>
          </Section>

          <Section id="unwrap" title="Unwrapping (ERC-7984 → ERC-20)">
            <P>Unwrapping is a <B>two-step async process</B> because the amount to burn is encrypted — the chain can&apos;t read it directly. The FHE coprocessor needs to decrypt it publicly before the underlying tokens can be released.</P>
            <Steps items={[
              "Switch to Unwrap mode and reveal your balance (click Reveal balance if not already decrypted)",
              "Enter the amount to unwrap",
              "Step 1 — your encrypted amount is submitted to the wrapper. The contract emits an UnwrapRequested event.",
              "Step 2 — the Zama relayer publicly decrypts the burned amount and provides a proof",
              "Step 3 — finalizeUnwrap is called with the cleartext amount + proof, releasing your ERC-20 tokens",
            ]} />
            <Callout type="warning">Unwrap takes longer than wrap because of the relayer decryption step (~10–30s). The UI handles this automatically — just wait after confirming the transaction.</Callout>
          </Section>

          <Section id="decrypt" title="Decrypting your balance (EIP-712)">
            <P>FHE balances are encrypted on-chain. To read your own balance, you generate a temporary keypair, sign an EIP-712 message authorising the relayer to decrypt only for you, and the relayer returns the plaintext — never touching the chain.</P>
            <Steps items={[
              "Click 🔓 on any registry card, or go to the Decrypt tab",
              "MetaMask asks you to sign an EIP-712 typed message (no gas, no transaction)",
              "The relayer verifies your signature and decrypts only the balance belonging to your address",
              "The plaintext balance appears — only in your browser, never on-chain",
            ]} />
            <P>The Decrypt tab also supports <B>arbitrary decrypt</B> — paste any ERC-7984 contract address to decrypt your balance in that token, even if it&apos;s not in the registry.</P>
            <Callout>Your signature expires after 7 days. If you wrap more tokens, click 🔓 again to get the updated balance.</Callout>
          </Section>

          <Section id="fhe" title="How FHE works">
            <P><B>Fully Homomorphic Encryption (FHE)</B> lets smart contracts perform computations on encrypted data without ever decrypting it. Zama&apos;s <a href="https://docs.zama.ai/fhevm" target="_blank" rel="noopener noreferrer" style={{ color: "#FFD60A" }}>fhEVM</a> brings this to Ethereum.</P>
            <P>When you wrap tokens:</P>
            <ul style={{ paddingLeft: 20, color: "#aaa", lineHeight: 2, fontSize: 14 }}>
              <li>Your balance is stored as an <Code>euint64</Code> — an encrypted 64-bit integer</li>
              <li>Transfers between confidential token holders work without either party seeing the other&apos;s balance</li>
              <li>The ERC-7984 standard defines the interface for these confidential tokens</li>
            </ul>
            <P>When you decrypt:</P>
            <ul style={{ paddingLeft: 20, color: "#aaa", lineHeight: 2, fontSize: 14 }}>
              <li>You generate a temporary RSA keypair locally</li>
              <li>You sign an EIP-712 message authorising the Zama Gateway to decrypt your balance encrypted with your public key</li>
              <li>The Gateway returns the result encrypted to you — only your private key can read it</li>
              <li>Nothing touches the chain; nothing is publicly revealed</li>
            </ul>
          </Section>

          <Section id="contracts" title="Contract addresses (Sepolia)">
            <P>All contracts are deployed on Ethereum Sepolia testnet.</P>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e1d2a" }}>
                  {["Token", "ERC-20 address", "ERC-7984 address"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#555", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["USDTMock", "0xa7dA08FafDC9097…", "0x4E7B06D7896559…"],
                  ["USDCMock", "0x9b5Cd13b8eFbB5…", "0x7c5BF43B851c1d…"],
                  ["WETHMock", "0xff54739b16576F…", "0x46208622DA27d9…"],
                  ["BRONMock", "0xFf021fB13cA64e…", "0xaa5612FA27c927…"],
                  ["ZAMAMock", "0x75355a85c6FB9d…", "0xf2D628d2598aF4…"],
                  ["ctGBPMock", "0x93c931278A2aad…", "0xfCE5c7069c5525…"],
                  ["cXAUtMock", "0x24377AE4AA0C45…", "0xe4FcF848739845…"],
                  ["ctGBP", "0xf6ef9adb61a48e…", "0x167dc962808b32…"],
                ].map(([name, erc20, conf]) => (
                  <tr key={name} style={{ borderBottom: "1px solid #16151f" }}>
                    <td style={{ padding: "10px 12px", color: "#f4f3f8", fontWeight: 600 }}>{name}</td>
                    <td style={{ padding: "10px 12px", color: "#888" }}>{erc20}</td>
                    <td style={{ padding: "10px 12px", color: "#888" }}>{conf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 20 }}>
              <Addr label="Wrappers Registry" addr="0x2f0750Bbb0A246059d80e94c454586a7F27a128e" />
            </div>
          </Section>

        </main>
      </div>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{ marginBottom: 64, scrollMarginTop: 80 }}>
      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: "-.02em", marginBottom: 16, color: "#f4f3f8" }}>{title}</h2>
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 15, lineHeight: 1.75, color: "#aaa", marginBottom: 14 }}>{children}</p>;
}

function B({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: "#f4f3f8", fontWeight: 600 }}>{children}</strong>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, background: "#1a1928", border: "1px solid #2a2938", borderRadius: 5, padding: "1px 6px", color: "#c9c3f5" }}>{children}</code>;
}

function Callout({ children, type = "default" }: { children: React.ReactNode; type?: "default" | "warning" | "info" }) {
  const colors = { default: "#9d8eff", warning: "#f5a623", info: "#4fc3f7" };
  const bgs = { default: "rgba(157,142,255,.07)", warning: "rgba(245,166,35,.07)", info: "rgba(79,195,247,.07)" };
  return (
    <div style={{ margin: "16px 0", padding: "12px 16px", borderRadius: 10, borderLeft: `3px solid ${colors[type]}`, background: bgs[type], fontSize: 14, color: "#bbb", lineHeight: 1.7 }}>{children}</div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol style={{ paddingLeft: 0, listStyle: "none", marginBottom: 14 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: "flex", gap: 14, marginBottom: 10, fontSize: 14, color: "#aaa", lineHeight: 1.6 }}>
          <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 7, background: "#1a1928", border: "1px solid #2a2938", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12, color: "#FFD60A" }}>{i + 1}</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Cards({ items }: { items: { icon: string; title: string; desc: string }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: 12, margin: "20px 0" }}>
      {items.map(item => (
        <div key={item.title} style={{ padding: "14px 16px", borderRadius: 12, background: "#13121c", border: "1px solid #1e1d2a" }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>{item.icon}</div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#f4f3f8", marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>{item.title}</div>
          <div style={{ fontSize: 12.5, color: "#777", lineHeight: 1.6 }}>{item.desc}</div>
        </div>
      ))}
    </div>
  );
}

function Addr({ label, addr }: { label: string; addr: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "#13121c", border: "1px solid #1e1d2a", marginBottom: 8 }}>
      <span style={{ fontSize: 13, color: "#777", minWidth: 140 }}>{label}</span>
      <a href={`https://sepolia.etherscan.io/address/${addr}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: "#9d8eff", textDecoration: "none" }}>{addr}</a>
    </div>
  );
}
