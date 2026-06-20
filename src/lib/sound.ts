"use client";

// Plays the bundled success sound on wrap/unwrap completion.
let audio: HTMLAudioElement | null = null;

export function playSuccess() {
  if (typeof window === "undefined") return;
  try {
    if (!audio) {
      audio = new Audio("/sounds/success.mp3");
      audio.volume = 0.5;
    }
    audio.currentTime = 0;
    void audio.play();
  } catch {
    // autoplay policy blocked — silently ignore
  }
}

// Synthesised coin-drop for the faucet — bright triangle arpeggio + metallic tick.
export function playCoin() {
  if (typeof window === "undefined") return;
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const coin = (freq: number, start: number) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.connect(env);
      env.connect(ctx.destination);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.85, now + start + 0.18);
      env.gain.setValueAtTime(0.16, now + start);
      env.gain.exponentialRampToValueAtTime(0.001, now + start + 0.22);
      osc.start(now + start);
      osc.stop(now + start + 0.25);
    };

    // bright "ching" arpeggio
    coin(988, 0);
    coin(1319, 0.07);
    coin(1760, 0.13);

    // metallic tick (filtered noise) for the clink
    const len = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ctx.createBufferSource();
    const hpf = ctx.createBiquadFilter();
    const ng = ctx.createGain();
    src.buffer = buf;
    hpf.type = "highpass";
    hpf.frequency.value = 4000;
    ng.gain.value = 0.25;
    src.connect(hpf);
    hpf.connect(ng);
    ng.connect(ctx.destination);
    src.start(now + 0.13);

    setTimeout(() => ctx.close(), 700);
  } catch {
    // autoplay policy blocked — silently ignore
  }
}
