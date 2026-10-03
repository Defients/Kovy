/// <reference types="vite/client" />

interface Window {
  webkitAudioContext?: typeof AudioContext;
  EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
}
