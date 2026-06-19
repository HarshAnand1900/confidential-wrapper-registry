"use client";

import { useEffect, useRef } from "react";

interface VeilCanvasProps {
  screen: "landing" | "app";
  heroRef: React.RefObject<HTMLDivElement | null>;
  chipsRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Cursor-reactive canvas background ported verbatim from the Veil design.
 * Landing: "decrypt lens" ciphertext field. App: FHE lattice grid.
 */
export function VeilCanvas({ screen, heroRef, chipsRef }: VeilCanvasProps) {
  const gridRef = useRef<HTMLCanvasElement>(null);
  const screenRef = useRef(screen);
  screenRef.current = screen;

  useEffect(() => {
    const cv = gridRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let w = 0,
      h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
    const sp = 46;
    const cipherChars = "01⊕≡⟨⟩{}∎λΞ◇";
    let fhe: { bx: number; by: number; x: number; y: number; f: number }[][] = [];
    const bits: { x: number; y: number; vx: number; vy: number; ch: string; a: number }[] = [];
    const hexes: { x: number; y: number; vx: number; vy: number; text: string; a: number }[] = [];
    let cells: { x: number; y: number; plain: string; scram: string }[] = [];
    let lensX = 0,
      lensY = 0;
    const POOL = [
      "cUSDC 1,280.00", "cWETH 0.8500", "cDAI 940.00", "cEURC 1,500.0",
      "cUSDT 3,200.0", "cWBTC 0.04200", "ERC-7984", "ERC-20 → c",
      "0xA8F3…E7B5", "0x9C44…2139", "encrypted", "EIP-712", "wrap →",
      "← unwrap", "decrypt", "Sepolia", "FHE handle", "confidential",
      "balance ***", "sealed", "euint64", "reveal",
    ];
    const CIPH = "#%&$@/<>01XΞ⊕≡λ◇{}";
    const scramText = (str: string) =>
      str.replace(/[^ ]/g, () => CIPH[(Math.random() * CIPH.length) | 0]);

    const buildFHE = () => {
      fhe = [];
      const cols = Math.ceil(w / sp) + 2,
        rows = Math.ceil(h / sp) + 2;
      for (let j = 0; j < rows; j++) {
        const row = [];
        for (let i = 0; i < cols; i++) {
          row.push({ bx: i * sp - sp, by: j * sp - sp, x: 0, y: 0, f: 0 });
        }
        fhe.push(row);
      }
      bits.length = 0;
      const n = Math.max(24, Math.round((w * h) / 24000));
      for (let k = 0; k < n; k++) {
        bits.push({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
          ch: Math.random() < 0.5 ? "0" : "1", a: Math.random() * 0.1 + 0.03,
        });
      }
      hexes.length = 0;
      const hn = Math.max(8, Math.round((w * h) / 110000)),
        hch = "0123456789ABCDEF";
      for (let k = 0; k < hn; k++) {
        let str = "0x";
        for (let q = 0; q < 4; q++) str += hch[Math.floor(Math.random() * 16)];
        hexes.push({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.1, vy: (Math.random() - 0.5) * 0.1,
          text: str, a: Math.random() * 0.05 + 0.04,
        });
      }
      cells = [];
      const cw = 156, chh = 30, cc = Math.ceil(w / cw) + 1, cr = Math.ceil(h / chh) + 1;
      for (let j = 0; j < cr; j++) {
        for (let i = 0; i < cc; i++) {
          const plain = POOL[(Math.random() * POOL.length) | 0];
          cells.push({ x: i * cw + 16, y: j * chh + 18, plain, scram: scramText(plain) });
        }
      }
      if (!lensX) {
        lensX = w / 2;
        lensY = h / 2;
      }
    };

    const resize = () => {
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildFHE();
    };
    resize();

    const onResize = () => resize();
    const onMove = (e: MouseEvent) => {
      mouse.tx = e.clientX;
      mouse.ty = e.clientY;
      if (screenRef.current === "landing") {
        const nx = e.clientX / window.innerWidth - 0.5,
          ny = e.clientY / window.innerHeight - 0.5;
        if (heroRef.current)
          heroRef.current.style.transform = `translate3d(${nx * -16}px,${ny * -10}px,0)`;
        if (chipsRef.current)
          chipsRef.current.style.transform = `translate3d(${nx * 48}px,${ny * 32}px,0)`;
      }
    };
    const onLeave = () => {
      mouse.tx = -9999;
      mouse.ty = -9999;
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onLeave);

    let t = 0,
      frame = 0,
      scz = 0,
      raf = 0;

    const themeColors = () => {
      const root = cv.parentElement;
      if (!root) return { r: "188", g: "170", b: "255", a: 0.16 };
      const cs = getComputedStyle(root);
      return {
        r: cs.getPropertyValue("--grid-r").trim() || "188",
        g: cs.getPropertyValue("--grid-g").trim() || "170",
        b: cs.getPropertyValue("--grid-b").trim() || "255",
        a: parseFloat(cs.getPropertyValue("--grid-a")) || 0.16,
      };
    };

    const drawHero = () => {
      const g0 = ctx.createLinearGradient(0, 0, w, h);
      g0.addColorStop(0, "#07080f");
      g0.addColorStop(1, "#0a0b14");
      ctx.fillStyle = g0;
      ctx.fillRect(0, 0, w, h);

      let tx, ty;
      if (mouse.tx > -9000) {
        tx = mouse.tx;
        ty = mouse.ty;
      } else {
        tx = w * (0.5 + 0.3 * Math.sin(t * 0.45));
        ty = h * (0.5 + 0.27 * Math.sin(t * 0.31 + 1.1));
      }
      lensX += (tx - lensX) * 0.09;
      lensY += (ty - lensY) * 0.09;
      const R = Math.max(118, Math.min(w, h) * 0.21);

      const lg = ctx.createRadialGradient(lensX, lensY, 0, lensX, lensY, R * 1.2);
      lg.addColorStop(0, "rgba(70,235,200,0.13)");
      lg.addColorStop(0.6, "rgba(70,235,200,0.04)");
      lg.addColorStop(1, "rgba(70,235,200,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, w, h);

      if (frame % 2 === 0) {
        for (let q = 0; q < 8; q++) {
          const c = cells[(Math.random() * cells.length) | 0];
          if (c) c.scram = scramText(c.plain);
        }
      }

      ctx.font = '13px "JetBrains Mono", monospace';
      ctx.textAlign = "start";
      ctx.textBaseline = "middle";
      for (const c of cells) {
        const dx = c.x - lensX,
          dy = c.y - lensY,
          d = Math.sqrt(dx * dx + dy * dy);
        if (d < R) {
          const edge = Math.min(1, (R - d) / 46);
          ctx.fillStyle = `rgba(150,245,218,${0.5 + 0.45 * edge})`;
          ctx.fillText(c.plain, c.x, c.y);
        } else {
          ctx.fillStyle = "rgba(150,156,184,0.10)";
          ctx.fillText(c.scram, c.x, c.y);
        }
      }

      ctx.lineWidth = 1.4;
      ctx.strokeStyle = "rgba(120,245,212,0.55)";
      ctx.beginPath();
      ctx.arc(lensX, lensY, R, 0, 6.283);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(120,245,212,0.16)";
      ctx.beginPath();
      ctx.arc(lensX, lensY, R - 7, 0, 6.283);
      ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = "rgba(120,245,212,0.5)";
      for (let a = 0; a < 4; a++) {
        const ang = (a * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(lensX + Math.cos(ang) * (R - 4), lensY + Math.sin(ang) * (R - 4));
        ctx.lineTo(lensX + Math.cos(ang) * (R + 6), lensY + Math.sin(ang) * (R + 6));
        ctx.stroke();
      }
    };

    const drawFHE = () => {
      const { r, g, b, a } = themeColors();
      const pull = 30,
        sig = 165;
      for (let j = 0; j < fhe.length; j++) {
        for (let i = 0; i < fhe[j].length; i++) {
          const n = fhe[j][i];
          const dx = mouse.x - n.bx,
            dy = mouse.y - n.by,
            d2 = dx * dx + dy * dy;
          const f = Math.exp(-d2 / (2 * sig * sig)),
            dist = Math.sqrt(d2) || 1;
          n.x = n.bx + (dx / dist) * pull * f + Math.sin(t + n.bx * 0.01) * 0.7;
          n.y = n.by + (dy / dist) * pull * f + Math.cos(t + n.by * 0.01) * 0.7;
          n.f = f;
        }
      }
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
      for (const bt of bits) {
        bt.x += bt.vx;
        bt.y += bt.vy;
        if (bt.x < 0) bt.x = w;
        if (bt.x > w) bt.x = 0;
        if (bt.y < 0) bt.y = h;
        if (bt.y > h) bt.y = 0;
        if (frame % 24 === 0 && Math.random() < 0.12) bt.ch = Math.random() < 0.5 ? "0" : "1";
        ctx.fillStyle = `rgba(${r},${g},${b},${bt.a})`;
        ctx.fillText(bt.ch, bt.x, bt.y);
      }
      for (let j = 0; j < fhe.length; j++) {
        for (let i = 0; i < fhe[j].length; i++) {
          const n = fhe[j][i];
          if (i < fhe[j].length - 1) {
            const m = fhe[j][i + 1];
            ctx.strokeStyle = `rgba(${r},${g},${b},${a + (n.f + m.f) * 0.22})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
          if (j < fhe.length - 1) {
            const m = fhe[j + 1][i];
            ctx.strokeStyle = `rgba(${r},${g},${b},${a + (n.f + m.f) * 0.22})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
          if (n.f > 0.16 && i < fhe[j].length - 1 && j < fhe.length - 1) {
            const m = fhe[j + 1][i + 1];
            ctx.strokeStyle = `rgba(${r},${g},${b},${n.f * 0.5})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
        }
      }
      if (frame % 6 === 0) scz++;
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let j = 0; j < fhe.length; j++) {
        for (let i = 0; i < fhe[j].length; i++) {
          const n = fhe[j][i];
          if (n.f > 0.3) {
            const ch = cipherChars[(i * 7 + j * 13 + scz) % cipherChars.length];
            ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(0.92, n.f)})`;
            ctx.fillText(ch, n.x, n.y);
          } else if (n.f > 0.06) {
            ctx.fillStyle = `rgba(${r},${g},${b},${n.f * 1.1})`;
            ctx.beginPath();
            ctx.arc(n.x, n.y, 1.2 + n.f * 1.5, 0, 6.283);
            ctx.fill();
          }
        }
      }
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    };

    const loop = () => {
      t += 0.012;
      frame++;
      mouse.x += (mouse.tx - mouse.x) * 0.12;
      mouse.y += (mouse.ty - mouse.y) * 0.12;
      ctx.clearRect(0, 0, w, h);
      if (screenRef.current === "landing") drawHero();
      else drawFHE();
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [heroRef, chipsRef]);

  return (
    <canvas
      ref={gridRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
