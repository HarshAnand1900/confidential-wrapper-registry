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

let coinAudio: HTMLAudioElement | null = null;

export function playCoin() {
  if (typeof window === "undefined") return;
  try {
    if (!coinAudio) {
      coinAudio = new Audio("/sounds/coin.mp3");
      coinAudio.volume = 0.5;
    }
    coinAudio.currentTime = 0;
    void coinAudio.play();
  } catch {
    // autoplay policy blocked — silently ignore
  }
}
