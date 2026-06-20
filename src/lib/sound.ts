// Synthesised success chime using Web Audio API — no external files.
// Two ascending sine tones, like DEX swap-complete sounds.
export function playSuccess() {
  if (typeof window === "undefined") return;
  try {
    const ctx = new AudioContext();

    const play = (freq: number, startAt: number, duration: number, gain: number) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.connect(env);
      env.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, ctx.currentTime + startAt);
      env.gain.linearRampToValueAtTime(gain, ctx.currentTime + startAt + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + duration);
    };

    // First tone — E5
    play(659.25, 0, 0.18, 0.18);
    // Second tone — B5 (ascending)
    play(987.77, 0.12, 0.28, 0.14);
    // Harmonic shimmer on second tone
    play(1975.53, 0.12, 0.22, 0.05);

    setTimeout(() => ctx.close(), 800);
  } catch {
    // AudioContext blocked (autoplay policy) — silently ignore
  }
}
