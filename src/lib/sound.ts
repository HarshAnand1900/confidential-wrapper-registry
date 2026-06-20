"use client";

export function playSuccess() {
  if (typeof window === "undefined") return;
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // --- whoosh sweep (filtered noise burst) ---
    const bufLen = ctx.sampleRate * 0.35;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const whoosh = ctx.createBufferSource();
    whoosh.buffer = buf;

    const bpf = ctx.createBiquadFilter();
    bpf.type = "bandpass";
    bpf.frequency.setValueAtTime(200, now);
    bpf.frequency.exponentialRampToValueAtTime(2800, now + 0.22);
    bpf.Q.value = 1.4;

    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0, now);
    whooshGain.gain.linearRampToValueAtTime(0.22, now + 0.04);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    whoosh.connect(bpf);
    bpf.connect(whooshGain);
    whooshGain.connect(ctx.destination);
    whoosh.start(now);
    whoosh.stop(now + 0.35);

    // --- confirmation click (short sine pop) ---
    const click = (freq: number, t: number, dur: number, vol: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t); o.stop(t + dur + 0.01);
    };

    // two-tone lock-in: thud then bright ding
    click(180, now + 0.18, 0.09, 0.28);   // low thud
    click(880, now + 0.22, 0.14, 0.18);   // mid ding
    click(1760, now + 0.26, 0.18, 0.10);  // high shimmer

    // --- subtle reverb tail (convolver with impulse) ---
    const irLen = ctx.sampleRate * 0.6;
    const irBuf = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = irBuf.getChannelData(c);
      for (let i = 0; i < irLen; i++)
        ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.5);
    }
    const reverb = ctx.createConvolver();
    reverb.buffer = irBuf;
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.08;
    whooshGain.connect(reverb);
    reverb.connect(reverbGain);
    reverbGain.connect(ctx.destination);

    setTimeout(() => ctx.close(), 1200);
  } catch {
    // autoplay policy or unsupported — silent fail
  }
}
