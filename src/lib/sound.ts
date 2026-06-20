"use client";

function ctx() {
  return new AudioContext();
}

// ── Option 1: "Uniswap" — clean ascending chime, soft and satisfying ──────
export function sound1() {
  try {
    const c = ctx(), t = c.currentTime;
    const osc = (freq: number, start: number, dur: number, vol: number) => {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t + start);
      g.gain.linearRampToValueAtTime(vol, t + start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
      o.start(t + start); o.stop(t + start + dur + 0.01);
    };
    osc(523, 0, 0.25, 0.15);      // C5
    osc(659, 0.08, 0.25, 0.13);   // E5
    osc(784, 0.16, 0.35, 0.11);   // G5
    osc(1047, 0.24, 0.4, 0.09);   // C6
    setTimeout(() => c.close(), 900);
  } catch {}
}

// ── Option 2: "Vault lock" — deep thud + high sparkle, FHE-themed ─────────
export function sound2() {
  try {
    const c = ctx(), t = c.currentTime;
    // low thud
    const thud = c.createOscillator(), tg = c.createGain();
    thud.connect(tg); tg.connect(c.destination);
    thud.type = "sine";
    thud.frequency.setValueAtTime(120, t);
    thud.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    tg.gain.setValueAtTime(0.4, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    thud.start(t); thud.stop(t + 0.2);
    // high sparkle
    [1200, 1600, 2100].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + 0.1 + i * 0.06);
      g.gain.linearRampToValueAtTime(0.08, t + 0.12 + i * 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38 + i * 0.06);
      o.start(t + 0.1 + i * 0.06); o.stop(t + 0.45 + i * 0.06);
    });
    setTimeout(() => c.close(), 800);
  } catch {}
}

// ── Option 3: "Coin drop" — retro cash register feel ─────────────────────
export function sound3() {
  try {
    const c = ctx(), t = c.currentTime;
    const coin = (freq: number, start: number) => {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = "triangle"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.18, t + start);
      g.gain.exponentialRampToValueAtTime(0.001, t + start + 0.22);
      o.start(t + start); o.stop(t + start + 0.25);
    };
    coin(987, 0);
    coin(1318, 0.09);
    coin(1760, 0.16);
    // quick metallic tick
    const buf = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = c.createBufferSource(), hpf = c.createBiquadFilter(), ng = c.createGain();
    src.buffer = buf; hpf.type = "highpass"; hpf.frequency.value = 4000;
    ng.gain.value = 0.3;
    src.connect(hpf); hpf.connect(ng); ng.connect(c.destination);
    src.start(t + 0.16);
    setTimeout(() => c.close(), 700);
  } catch {}
}

// ── Option 4: "Cyber ping" — sci-fi digital blip, matches the FHE vibe ───
export function sound4() {
  try {
    const c = ctx(), t = c.currentTime;
    // fast frequency sweep up
    const o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = "sawtooth";
    o.frequency.setValueAtTime(80, t);
    o.frequency.exponentialRampToValueAtTime(1400, t + 0.1);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.25);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.02);
    g.gain.setValueAtTime(0.12, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.start(t); o.stop(t + 0.32);
    // confirmation beep
    const o2 = c.createOscillator(), g2 = c.createGain();
    o2.connect(g2); g2.connect(c.destination);
    o2.type = "sine"; o2.frequency.value = 1200;
    g2.gain.setValueAtTime(0, t + 0.22);
    g2.gain.linearRampToValueAtTime(0.14, t + 0.24);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.46);
    o2.start(t + 0.22); o2.stop(t + 0.5);
    setTimeout(() => c.close(), 700);
  } catch {}
}

// ── Option 5: "Level up" — upward arpeggio, feels rewarding ──────────────
export function sound5() {
  try {
    const c = ctx(), t = c.currentTime;
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((freq, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = "sine"; o.frequency.value = freq;
      const s = i * 0.07;
      g.gain.setValueAtTime(0, t + s);
      g.gain.linearRampToValueAtTime(0.13 - i * 0.01, t + s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + s + 0.28);
      o.start(t + s); o.stop(t + s + 0.3);
    });
    setTimeout(() => c.close(), 900);
  } catch {}
}

// ─── Active one — swap this import in page.tsx to pick ───────────────────
export const playSuccess = sound2;
