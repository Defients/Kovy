// ============================================================
// Sound Packs — audio theme presets
//
// Replaces raw audio config with themed sound packs that
// define synthesis parameters for each behavior/mood sound.
// All sounds are synthesized via Web Audio API — no audio files.
// ============================================================

export type SoundPackId = string;

export interface OscPartial {
  ratio: number;
  type: OscillatorType;
  gain: number;
  detune?: number;
}

export interface SoundParams {
  frequency: number;
  duration: number;
  volume: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  oscillators: OscPartial[];
  filter?: { type: BiquadFilterType; freq: number; Q?: number };
  glide?: { from: number; to: number };
  noise?: { volume: number; type: BiquadFilterType; freq: number; Q?: number };
  vibrato?: { rate: number; depth: number };
}

export interface SoundPack {
  id: SoundPackId;
  name: string;
  icon: string;
  description: string;
  sounds: {
    poke: SoundParams;
    hover: SoundParams;
    swipe: SoundParams;
    nap: SoundParams;
    dream: SoundParams;
    stretch: SoundParams;
    yawn: SoundParams;
    startle: SoundParams;
    celebrate: SoundParams;
    wander: SoundParams;
  };
  builtin: boolean;
}

export type SoundPackKey = keyof SoundPack["sounds"];

function snd(opts: {
  freq: number; dur: number; vol: number;
  osc: OscPartial[];
  attack?: number; decay?: number; sustain?: number; release?: number;
  filter?: { type: BiquadFilterType; freq: number; Q?: number };
  glide?: { from: number; to: number };
  noise?: { volume: number; type: BiquadFilterType; freq: number; Q?: number };
  vibrato?: { rate: number; depth: number };
}): SoundParams {
  return {
    frequency: opts.freq,
    duration: opts.dur,
    volume: opts.vol,
    attack: opts.attack ?? 0.01,
    decay: opts.decay ?? 0.1,
    sustain: opts.sustain ?? 0.3,
    release: opts.release ?? 0.2,
    oscillators: opts.osc,
    filter: opts.filter,
    glide: opts.glide,
    noise: opts.noise,
    vibrato: opts.vibrato,
  };
}

const SILENT_SOUND = snd({
  freq: 0, dur: 0, vol: 0,
  osc: [{ ratio: 1, type: "sine", gain: 1 }],
});

export const BUILTIN_SOUND_PACKS: SoundPack[] = [
  {
    id: "default",
    name: "Default",
    icon: "🎵",
    description: "Warm, soft companion tones with gentle harmonics",
    sounds: {
      poke: snd({ freq: 440, dur: 0.12, vol: 0.12, attack: 0.01, decay: 0.08, sustain: 0.2, release: 0.1,
        osc: [{ ratio: 1, type: "sine", gain: 0.7 }, { ratio: 2, type: "triangle", gain: 0.3 }],
        filter: { type: "lowpass", freq: 2000, Q: 1 } }),
      hover: snd({ freq: 330, dur: 0.1, vol: 0.08, attack: 0.02, decay: 0.06, sustain: 0.15, release: 0.08,
        osc: [{ ratio: 1, type: "sine", gain: 0.8 }, { ratio: 1.5, type: "sine", gain: 0.2 }],
        filter: { type: "lowpass", freq: 2000, Q: 1 } }),
      swipe: snd({ freq: 550, dur: 0.18, vol: 0.1, attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.15,
        osc: [{ ratio: 1, type: "triangle", gain: 0.6 }, { ratio: 2, type: "sine", gain: 0.4 }],
        filter: { type: "lowpass", freq: 2500, Q: 1 }, glide: { from: 0.8, to: 1.2 } }),
      nap: snd({ freq: 220, dur: 0.6, vol: 0.1, attack: 0.15, decay: 0.3, sustain: 0.4, release: 0.5,
        osc: [{ ratio: 1, type: "sine", gain: 0.7 }, { ratio: 2, type: "triangle", gain: 0.3 }],
        filter: { type: "lowpass", freq: 1500, Q: 1 }, vibrato: { rate: 5, depth: 3 } }),
      dream: snd({ freq: 180, dur: 1.2, vol: 0.08, attack: 0.5, decay: 0.5, sustain: 0.5, release: 1.0,
        osc: [{ ratio: 1, type: "sine", gain: 0.6 }, { ratio: 1.5, type: "sine", gain: 0.3 }, { ratio: 2, type: "triangle", gain: 0.2 }],
        filter: { type: "lowpass", freq: 1200, Q: 1 }, vibrato: { rate: 4, depth: 4 } }),
      stretch: snd({ freq: 300, dur: 0.35, vol: 0.1, attack: 0.05, decay: 0.2, sustain: 0.2, release: 0.3,
        osc: [{ ratio: 1, type: "sine", gain: 0.7 }, { ratio: 1.5, type: "triangle", gain: 0.3 }],
        filter: { type: "lowpass", freq: 2000, Q: 1 } }),
      yawn: snd({ freq: 260, dur: 0.45, vol: 0.1, attack: 0.1, decay: 0.3, sustain: 0.15, release: 0.4,
        osc: [{ ratio: 1, type: "sine", gain: 0.7 }, { ratio: 2, type: "triangle", gain: 0.3 }],
        filter: { type: "lowpass", freq: 1800, Q: 1 }, glide: { from: 1.2, to: 0.9 } }),
      startle: snd({ freq: 800, dur: 0.08, vol: 0.12, attack: 0.001, decay: 0.04, sustain: 0.05, release: 0.06,
        osc: [{ ratio: 1, type: "square", gain: 0.5 }, { ratio: 1, type: "sine", gain: 0.5 }],
        filter: { type: "lowpass", freq: 3000, Q: 1 } }),
      celebrate: snd({ freq: 660, dur: 0.25, vol: 0.12, attack: 0.01, decay: 0.15, sustain: 0.3, release: 0.2,
        osc: [{ ratio: 1, type: "triangle", gain: 0.5 }, { ratio: 1.5, type: "sine", gain: 0.3 }, { ratio: 2, type: "sine", gain: 0.2 }],
        filter: { type: "lowpass", freq: 2500, Q: 1 }, vibrato: { rate: 6, depth: 3 } }),
      wander: snd({ freq: 350, dur: 0.12, vol: 0.06, attack: 0.03, decay: 0.08, sustain: 0.1, release: 0.12,
        osc: [{ ratio: 1, type: "sine", gain: 0.8 }, { ratio: 1.5, type: "sine", gain: 0.2 }],
        filter: { type: "lowpass", freq: 2000, Q: 1 } }),
    },
    builtin: true,
  },
  {
    id: "chimes",
    name: "Chimes",
    icon: "🔔",
    description: "Crystalline bells with inharmonic shimmer and long decay",
    sounds: {
      poke: snd({ freq: 880, dur: 0.5, vol: 0.1, attack: 0.002, decay: 0.3, sustain: 0.0, release: 0.4,
        osc: [{ ratio: 1, type: "sine", gain: 0.5 }, { ratio: 2.76, type: "sine", gain: 0.3 }, { ratio: 5.4, type: "sine", gain: 0.15 }, { ratio: 8.93, type: "sine", gain: 0.08 }] }),
      hover: snd({ freq: 660, dur: 0.35, vol: 0.07, attack: 0.002, decay: 0.2, sustain: 0.0, release: 0.25,
        osc: [{ ratio: 1, type: "sine", gain: 0.5 }, { ratio: 2.76, type: "sine", gain: 0.25 }, { ratio: 5.4, type: "sine", gain: 0.12 }] }),
      swipe: snd({ freq: 990, dur: 0.45, vol: 0.09, attack: 0.002, decay: 0.25, sustain: 0.0, release: 0.35,
        osc: [{ ratio: 1, type: "sine", gain: 0.5 }, { ratio: 2.76, type: "sine", gain: 0.3 }, { ratio: 5.4, type: "sine", gain: 0.15 }] }),
      nap: snd({ freq: 440, dur: 1.0, vol: 0.08, attack: 0.1, decay: 0.5, sustain: 0.1, release: 0.8,
        osc: [{ ratio: 1, type: "sine", gain: 0.5 }, { ratio: 2.76, type: "sine", gain: 0.25 }, { ratio: 5.4, type: "sine", gain: 0.12 }, { ratio: 8.93, type: "sine", gain: 0.06 }] }),
      dream: snd({ freq: 330, dur: 1.8, vol: 0.07, attack: 0.3, decay: 0.7, sustain: 0.15, release: 1.5,
        osc: [{ ratio: 1, type: "sine", gain: 0.4 }, { ratio: 2.76, type: "sine", gain: 0.25 }, { ratio: 5.4, type: "sine", gain: 0.12 }, { ratio: 8.93, type: "sine", gain: 0.06 }] }),
      stretch: snd({ freq: 550, dur: 0.5, vol: 0.08, attack: 0.005, decay: 0.3, sustain: 0.0, release: 0.4,
        osc: [{ ratio: 1, type: "sine", gain: 0.5 }, { ratio: 2.76, type: "sine", gain: 0.25 }, { ratio: 5.4, type: "sine", gain: 0.12 }] }),
      yawn: snd({ freq: 494, dur: 0.6, vol: 0.08, attack: 0.05, decay: 0.35, sustain: 0.05, release: 0.5,
        osc: [{ ratio: 1, type: "sine", gain: 0.5 }, { ratio: 2.76, type: "sine", gain: 0.25 }, { ratio: 5.4, type: "sine", gain: 0.12 }] }),
      startle: snd({ freq: 1200, dur: 0.15, vol: 0.1, attack: 0.001, decay: 0.08, sustain: 0.0, release: 0.12,
        osc: [{ ratio: 1, type: "sine", gain: 0.5 }, { ratio: 2.76, type: "sine", gain: 0.3 }] }),
      celebrate: snd({ freq: 784, dur: 0.6, vol: 0.1, attack: 0.005, decay: 0.35, sustain: 0.05, release: 0.5,
        osc: [{ ratio: 1, type: "sine", gain: 0.5 }, { ratio: 2.76, type: "sine", gain: 0.3 }, { ratio: 5.4, type: "sine", gain: 0.15 }, { ratio: 8.93, type: "sine", gain: 0.08 }] }),
      wander: snd({ freq: 587, dur: 0.3, vol: 0.06, attack: 0.005, decay: 0.15, sustain: 0.0, release: 0.25,
        osc: [{ ratio: 1, type: "sine", gain: 0.5 }, { ratio: 2.76, type: "sine", gain: 0.2 }, { ratio: 5.4, type: "sine", gain: 0.1 }] }),
    },
    builtin: true,
  },
  {
    id: "retro",
    name: "Retro",
    icon: "👾",
    description: "Punchy 8-bit chiptune with detuned square waves",
    sounds: {
      poke: snd({ freq: 440, dur: 0.1, vol: 0.14, attack: 0.005, decay: 0.05, sustain: 0.1, release: 0.05,
        osc: [{ ratio: 1, type: "square", gain: 0.6 }, { ratio: 1, type: "square", gain: 0.4, detune: 5 }] }),
      hover: snd({ freq: 330, dur: 0.08, vol: 0.1, attack: 0.005, decay: 0.04, sustain: 0.08, release: 0.04,
        osc: [{ ratio: 1, type: "square", gain: 0.7 }, { ratio: 2, type: "sawtooth", gain: 0.3 }] }),
      swipe: snd({ freq: 550, dur: 0.12, vol: 0.12, attack: 0.005, decay: 0.06, sustain: 0.1, release: 0.08,
        osc: [{ ratio: 1, type: "square", gain: 0.6 }, { ratio: 1, type: "sawtooth", gain: 0.4, detune: -10 }],
        glide: { from: 0.7, to: 1.3 } }),
      nap: snd({ freq: 220, dur: 0.4, vol: 0.1, attack: 0.03, decay: 0.15, sustain: 0.2, release: 0.3,
        osc: [{ ratio: 1, type: "square", gain: 0.6 }, { ratio: 1.5, type: "square", gain: 0.3 }, { ratio: 2, type: "sawtooth", gain: 0.2 }] }),
      dream: snd({ freq: 165, dur: 0.8, vol: 0.08, attack: 0.1, decay: 0.3, sustain: 0.3, release: 0.6,
        osc: [{ ratio: 1, type: "square", gain: 0.5 }, { ratio: 1.5, type: "square", gain: 0.3 }, { ratio: 2, type: "sawtooth", gain: 0.2 }] }),
      stretch: snd({ freq: 330, dur: 0.18, vol: 0.12, attack: 0.005, decay: 0.1, sustain: 0.1, release: 0.1,
        osc: [{ ratio: 1, type: "square", gain: 0.6 }, { ratio: 2, type: "sawtooth", gain: 0.3 }] }),
      yawn: snd({ freq: 247, dur: 0.25, vol: 0.12, attack: 0.02, decay: 0.12, sustain: 0.1, release: 0.15,
        osc: [{ ratio: 1, type: "square", gain: 0.6 }, { ratio: 1.5, type: "sawtooth", gain: 0.3 }],
        glide: { from: 1.3, to: 0.8 } }),
      startle: snd({ freq: 880, dur: 0.06, vol: 0.16, attack: 0.001, decay: 0.02, sustain: 0.05, release: 0.03,
        osc: [{ ratio: 1, type: "square", gain: 0.7 }, { ratio: 1.5, type: "square", gain: 0.3 }] }),
      celebrate: snd({ freq: 660, dur: 0.15, vol: 0.14, attack: 0.005, decay: 0.08, sustain: 0.15, release: 0.1,
        osc: [{ ratio: 1, type: "square", gain: 0.5 }, { ratio: 1.5, type: "square", gain: 0.3 }, { ratio: 2, type: "sawtooth", gain: 0.2 }] }),
      wander: snd({ freq: 392, dur: 0.08, vol: 0.08, attack: 0.005, decay: 0.04, sustain: 0.05, release: 0.04,
        osc: [{ ratio: 1, type: "square", gain: 0.7 }, { ratio: 2, type: "sawtooth", gain: 0.2 }] }),
    },
    builtin: true,
  },
  {
    id: "nature",
    name: "Nature",
    icon: "🍃",
    description: "Organic water and wind tones with filtered noise texture",
    sounds: {
      poke: snd({ freq: 523, dur: 0.2, vol: 0.08, attack: 0.02, decay: 0.1, sustain: 0.1, release: 0.2,
        osc: [{ ratio: 1, type: "sine", gain: 0.7 }, { ratio: 2, type: "sine", gain: 0.2 }],
        filter: { type: "lowpass", freq: 1500, Q: 1 },
        noise: { volume: 0.03, type: "bandpass", freq: 3000, Q: 2 } }),
      hover: snd({ freq: 392, dur: 0.15, vol: 0.05, attack: 0.03, decay: 0.08, sustain: 0.08, release: 0.15,
        osc: [{ ratio: 1, type: "sine", gain: 0.8 }, { ratio: 1.5, type: "sine", gain: 0.15 }],
        filter: { type: "lowpass", freq: 1200, Q: 1 },
        noise: { volume: 0.02, type: "bandpass", freq: 2000, Q: 3 } }),
      swipe: snd({ freq: 659, dur: 0.25, vol: 0.07, attack: 0.02, decay: 0.12, sustain: 0.08, release: 0.2,
        osc: [{ ratio: 1, type: "sine", gain: 0.6 }, { ratio: 1.5, type: "sine", gain: 0.2 }],
        filter: { type: "lowpass", freq: 1800, Q: 1 },
        noise: { volume: 0.04, type: "bandpass", freq: 2500, Q: 2 } }),
      nap: snd({ freq: 262, dur: 0.8, vol: 0.07, attack: 0.2, decay: 0.3, sustain: 0.3, release: 0.6,
        osc: [{ ratio: 1, type: "sine", gain: 0.6 }, { ratio: 1.5, type: "sine", gain: 0.2 }, { ratio: 2, type: "triangle", gain: 0.15 }],
        filter: { type: "lowpass", freq: 1000, Q: 1 },
        noise: { volume: 0.02, type: "lowpass", freq: 500, Q: 1 } }),
      dream: snd({ freq: 196, dur: 1.5, vol: 0.06, attack: 0.4, decay: 0.5, sustain: 0.4, release: 1.2,
        osc: [{ ratio: 1, type: "sine", gain: 0.5 }, { ratio: 1.5, type: "sine", gain: 0.2 }, { ratio: 2, type: "triangle", gain: 0.15 }],
        filter: { type: "lowpass", freq: 800, Q: 1 },
        noise: { volume: 0.02, type: "lowpass", freq: 400, Q: 1 } }),
      stretch: snd({ freq: 440, dur: 0.4, vol: 0.07, attack: 0.05, decay: 0.2, sustain: 0.1, release: 0.3,
        osc: [{ ratio: 1, type: "sine", gain: 0.7 }, { ratio: 1.5, type: "triangle", gain: 0.2 }],
        filter: { type: "lowpass", freq: 1500, Q: 1 },
        noise: { volume: 0.02, type: "bandpass", freq: 2000, Q: 2 } }),
      yawn: snd({ freq: 349, dur: 0.5, vol: 0.07, attack: 0.1, decay: 0.25, sustain: 0.1, release: 0.4,
        osc: [{ ratio: 1, type: "sine", gain: 0.7 }, { ratio: 1.5, type: "sine", gain: 0.2 }],
        filter: { type: "lowpass", freq: 1200, Q: 1 },
        noise: { volume: 0.02, type: "lowpass", freq: 800, Q: 1 },
        glide: { from: 1.2, to: 0.9 } }),
      startle: snd({ freq: 698, dur: 0.12, vol: 0.09, attack: 0.01, decay: 0.04, sustain: 0.03, release: 0.08,
        osc: [{ ratio: 1, type: "sine", gain: 0.6 }, { ratio: 2, type: "sine", gain: 0.2 }],
        filter: { type: "lowpass", freq: 2000, Q: 1 },
        noise: { volume: 0.04, type: "bandpass", freq: 3000, Q: 3 } }),
      celebrate: snd({ freq: 587, dur: 0.35, vol: 0.08, attack: 0.02, decay: 0.15, sustain: 0.15, release: 0.3,
        osc: [{ ratio: 1, type: "sine", gain: 0.6 }, { ratio: 1.5, type: "sine", gain: 0.25 }, { ratio: 2, type: "triangle", gain: 0.15 }],
        filter: { type: "lowpass", freq: 1800, Q: 1 },
        noise: { volume: 0.03, type: "bandpass", freq: 2500, Q: 2 } }),
      wander: snd({ freq: 466, dur: 0.15, vol: 0.05, attack: 0.03, decay: 0.08, sustain: 0.05, release: 0.12,
        osc: [{ ratio: 1, type: "sine", gain: 0.7 }, { ratio: 1.5, type: "sine", gain: 0.15 }],
        filter: { type: "lowpass", freq: 1500, Q: 1 },
        noise: { volume: 0.02, type: "bandpass", freq: 2000, Q: 3 } }),
    },
    builtin: true,
  },
  {
    id: "vinyl",
    name: "Vinyl",
    icon: "🎙️",
    description: "Lo-fi warmth with record crackle and mellow tones",
    sounds: {
      poke: snd({ freq: 440, dur: 0.15, vol: 0.1, attack: 0.01, decay: 0.08, sustain: 0.15, release: 0.12,
        osc: [{ ratio: 1, type: "triangle", gain: 0.6 }, { ratio: 2, type: "sine", gain: 0.3 }],
        filter: { type: "lowpass", freq: 1500, Q: 1 },
        noise: { volume: 0.04, type: "bandpass", freq: 2000, Q: 5 } }),
      hover: snd({ freq: 330, dur: 0.12, vol: 0.07, attack: 0.02, decay: 0.06, sustain: 0.1, release: 0.1,
        osc: [{ ratio: 1, type: "triangle", gain: 0.7 }, { ratio: 1.5, type: "sine", gain: 0.2 }],
        filter: { type: "lowpass", freq: 1200, Q: 1 },
        noise: { volume: 0.03, type: "bandpass", freq: 1500, Q: 5 } }),
      swipe: snd({ freq: 550, dur: 0.2, vol: 0.09, attack: 0.01, decay: 0.1, sustain: 0.15, release: 0.15,
        osc: [{ ratio: 1, type: "triangle", gain: 0.5 }, { ratio: 2, type: "sine", gain: 0.3 }, { ratio: 1, type: "sawtooth", gain: 0.2, detune: -15 }],
        filter: { type: "lowpass", freq: 1800, Q: 1 },
        noise: { volume: 0.05, type: "bandpass", freq: 2500, Q: 4 } }),
      nap: snd({ freq: 220, dur: 0.7, vol: 0.08, attack: 0.1, decay: 0.25, sustain: 0.3, release: 0.5,
        osc: [{ ratio: 1, type: "triangle", gain: 0.6 }, { ratio: 1.5, type: "sine", gain: 0.25 }],
        filter: { type: "lowpass", freq: 1000, Q: 1 },
        noise: { volume: 0.03, type: "bandpass", freq: 1200, Q: 3 } }),
      dream: snd({ freq: 165, dur: 1.3, vol: 0.07, attack: 0.3, decay: 0.4, sustain: 0.4, release: 1.0,
        osc: [{ ratio: 1, type: "triangle", gain: 0.5 }, { ratio: 1.5, type: "sine", gain: 0.25 }, { ratio: 2, type: "sine", gain: 0.15 }],
        filter: { type: "lowpass", freq: 800, Q: 1 },
        noise: { volume: 0.02, type: "bandpass", freq: 1000, Q: 3 } }),
      stretch: snd({ freq: 300, dur: 0.35, vol: 0.09, attack: 0.03, decay: 0.15, sustain: 0.15, release: 0.25,
        osc: [{ ratio: 1, type: "triangle", gain: 0.6 }, { ratio: 1.5, type: "sine", gain: 0.25 }],
        filter: { type: "lowpass", freq: 1500, Q: 1 },
        noise: { volume: 0.03, type: "bandpass", freq: 2000, Q: 4 } }),
      yawn: snd({ freq: 260, dur: 0.5, vol: 0.09, attack: 0.08, decay: 0.2, sustain: 0.15, release: 0.35,
        osc: [{ ratio: 1, type: "triangle", gain: 0.6 }, { ratio: 1.5, type: "sine", gain: 0.25 }],
        filter: { type: "lowpass", freq: 1200, Q: 1 },
        noise: { volume: 0.02, type: "bandpass", freq: 1500, Q: 3 },
        glide: { from: 1.2, to: 0.9 } }),
      startle: snd({ freq: 600, dur: 0.1, vol: 0.11, attack: 0.001, decay: 0.04, sustain: 0.05, release: 0.06,
        osc: [{ ratio: 1, type: "square", gain: 0.4 }, { ratio: 1, type: "triangle", gain: 0.5 }],
        filter: { type: "lowpass", freq: 2000, Q: 1 },
        noise: { volume: 0.06, type: "bandpass", freq: 3000, Q: 6 } }),
      celebrate: snd({ freq: 523, dur: 0.3, vol: 0.1, attack: 0.01, decay: 0.15, sustain: 0.2, release: 0.25,
        osc: [{ ratio: 1, type: "triangle", gain: 0.5 }, { ratio: 1.5, type: "sine", gain: 0.3 }, { ratio: 2, type: "sine", gain: 0.2 }],
        filter: { type: "lowpass", freq: 1800, Q: 1 },
        noise: { volume: 0.04, type: "bandpass", freq: 2500, Q: 4 } }),
      wander: snd({ freq: 392, dur: 0.15, vol: 0.07, attack: 0.02, decay: 0.08, sustain: 0.1, release: 0.12,
        osc: [{ ratio: 1, type: "triangle", gain: 0.6 }, { ratio: 1.5, type: "sine", gain: 0.2 }],
        filter: { type: "lowpass", freq: 1500, Q: 1 },
        noise: { volume: 0.03, type: "bandpass", freq: 2000, Q: 5 } }),
    },
    builtin: true,
  },
  {
    id: "cosmic",
    name: "Cosmic",
    icon: "🌌",
    description: "Deep space pads with harmonic sines and meditative vibrato",
    sounds: {
      poke: snd({ freq: 523, dur: 0.4, vol: 0.08, attack: 0.05, decay: 0.15, sustain: 0.3, release: 0.3,
        osc: [{ ratio: 1, type: "sine", gain: 0.5 }, { ratio: 1.5, type: "sine", gain: 0.3 }, { ratio: 2, type: "sine", gain: 0.2 }],
        filter: { type: "lowpass", freq: 3000, Q: 1 }, vibrato: { rate: 3, depth: 5 } }),
      hover: snd({ freq: 392, dur: 0.35, vol: 0.06, attack: 0.08, decay: 0.12, sustain: 0.25, release: 0.25,
        osc: [{ ratio: 1, type: "sine", gain: 0.5 }, { ratio: 1.5, type: "sine", gain: 0.3 }, { ratio: 2, type: "sine", gain: 0.15 }],
        filter: { type: "lowpass", freq: 2500, Q: 1 }, vibrato: { rate: 3, depth: 4 } }),
      swipe: snd({ freq: 587, dur: 0.5, vol: 0.08, attack: 0.05, decay: 0.2, sustain: 0.25, release: 0.35,
        osc: [{ ratio: 1, type: "sine", gain: 0.4 }, { ratio: 1.5, type: "sine", gain: 0.3 }, { ratio: 2, type: "sine", gain: 0.2 }, { ratio: 3, type: "sine", gain: 0.1 }],
        filter: { type: "lowpass", freq: 3500, Q: 1 }, vibrato: { rate: 4, depth: 5 } }),
      nap: snd({ freq: 262, dur: 1.2, vol: 0.07, attack: 0.3, decay: 0.4, sustain: 0.5, release: 0.8,
        osc: [{ ratio: 1, type: "sine", gain: 0.4 }, { ratio: 1.5, type: "sine", gain: 0.3 }, { ratio: 2, type: "sine", gain: 0.2 }, { ratio: 3, type: "sine", gain: 0.1 }],
        filter: { type: "lowpass", freq: 2000, Q: 1 }, vibrato: { rate: 3, depth: 5 } }),
      dream: snd({ freq: 196, dur: 2.2, vol: 0.06, attack: 0.6, decay: 0.6, sustain: 0.5, release: 1.5,
        osc: [{ ratio: 1, type: "sine", gain: 0.4 }, { ratio: 1.5, type: "sine", gain: 0.3 }, { ratio: 2, type: "sine", gain: 0.2 }, { ratio: 3, type: "sine", gain: 0.15 }],
        filter: { type: "lowpass", freq: 1500, Q: 1 }, vibrato: { rate: 2, depth: 6 } }),
      stretch: snd({ freq: 349, dur: 0.5, vol: 0.07, attack: 0.1, decay: 0.2, sustain: 0.25, release: 0.35,
        osc: [{ ratio: 1, type: "sine", gain: 0.5 }, { ratio: 1.5, type: "sine", gain: 0.3 }, { ratio: 2, type: "sine", gain: 0.15 }],
        filter: { type: "lowpass", freq: 2800, Q: 1 }, vibrato: { rate: 3, depth: 4 } }),
      yawn: snd({ freq: 294, dur: 0.7, vol: 0.07, attack: 0.15, decay: 0.25, sustain: 0.2, release: 0.5,
        osc: [{ ratio: 1, type: "sine", gain: 0.5 }, { ratio: 1.5, type: "sine", gain: 0.25 }, { ratio: 2, type: "sine", gain: 0.15 }],
        filter: { type: "lowpass", freq: 2500, Q: 1 }, vibrato: { rate: 3, depth: 5 },
        glide: { from: 1.1, to: 0.9 } }),
      startle: snd({ freq: 698, dur: 0.2, vol: 0.09, attack: 0.02, decay: 0.08, sustain: 0.1, release: 0.15,
        osc: [{ ratio: 1, type: "sine", gain: 0.4 }, { ratio: 1.5, type: "sine", gain: 0.3 }, { ratio: 2, type: "sine", gain: 0.2 }],
        filter: { type: "lowpass", freq: 3500, Q: 1 }, vibrato: { rate: 5, depth: 4 } }),
      celebrate: snd({ freq: 523, dur: 0.6, vol: 0.09, attack: 0.05, decay: 0.2, sustain: 0.3, release: 0.4,
        osc: [{ ratio: 1, type: "sine", gain: 0.4 }, { ratio: 1.5, type: "sine", gain: 0.3 }, { ratio: 2, type: "sine", gain: 0.2 }, { ratio: 3, type: "sine", gain: 0.15 }],
        filter: { type: "lowpass", freq: 3000, Q: 1 }, vibrato: { rate: 4, depth: 5 } }),
      wander: snd({ freq: 440, dur: 0.3, vol: 0.06, attack: 0.08, decay: 0.12, sustain: 0.2, release: 0.2,
        osc: [{ ratio: 1, type: "sine", gain: 0.5 }, { ratio: 1.5, type: "sine", gain: 0.25 }, { ratio: 2, type: "sine", gain: 0.15 }],
        filter: { type: "lowpass", freq: 2800, Q: 1 }, vibrato: { rate: 3, depth: 4 } }),
    },
    builtin: true,
  },
  {
    id: "silent",
    name: "Silent",
    icon: "🔇",
    description: "No sounds at all",
    sounds: {
      poke: SILENT_SOUND,
      hover: SILENT_SOUND,
      swipe: SILENT_SOUND,
      nap: SILENT_SOUND,
      dream: SILENT_SOUND,
      stretch: SILENT_SOUND,
      yawn: SILENT_SOUND,
      startle: SILENT_SOUND,
      celebrate: SILENT_SOUND,
      wander: SILENT_SOUND,
    },
    builtin: true,
  },
];

/**
 * Play a single synthesized SoundParams tone through the Web Audio API.
 * Multi-oscillator signal chain: partials → masterGain(ADSR) → [filter] → dest
 * Optional: noise through its own filter, vibrato LFO, pitch glide.
 * Backward-compatible with old custom packs that use a single `type` field.
 */
export function playSoundPack(
  params: SoundParams,
  ctx: AudioContext,
  dest: AudioNode,
  masterVolume: number,
  pitchMult: number = 1,
): void {
  if (!params || params.volume <= 0 || params.duration <= 0) return;

  const now = ctx.currentTime;
  const peak = params.volume * Math.max(0, Math.min(1, masterVolume));
  const sustainLevel = peak * Math.max(0, Math.min(1, params.sustain));
  const total = Math.max(params.attack + params.decay + params.release, params.duration);
  const releaseStart = total - params.release;

  // Master gain with ADSR envelope
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.001, now);
  masterGain.gain.linearRampToValueAtTime(peak, now + params.attack);
  masterGain.gain.exponentialRampToValueAtTime(Math.max(0.001, sustainLevel), now + params.attack + params.decay);
  masterGain.gain.setValueAtTime(Math.max(0.001, sustainLevel), now + releaseStart);
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + total);

  // Optional output filter
  const filterNode = params.filter ? ctx.createBiquadFilter() : null;
  if (filterNode && params.filter) {
    filterNode.type = params.filter.type;
    filterNode.frequency.setValueAtTime(params.filter.freq, now);
    if (params.filter.Q !== undefined) filterNode.Q.setValueAtTime(params.filter.Q, now);
  }

  const outputDest = filterNode ?? masterGain;
  if (filterNode) {
    masterGain.connect(filterNode);
    filterNode.connect(dest);
  } else {
    masterGain.connect(dest);
  }

  // Backward-compat: old packs may have `type` instead of `oscillators`
  const oscPartials = params.oscillators?.length
    ? params.oscillators
    : [{ ratio: 1, type: (params as unknown as { type: OscillatorType }).type ?? "sine", gain: 1 }];

  // Optional vibrato LFO
  let lfo: OscillatorNode | null = null;
  let lfoGain: GainNode | null = null;
  if (params.vibrato) {
    lfo = ctx.createOscillator();
    lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(params.vibrato.rate, now);
    lfoGain.gain.setValueAtTime(params.vibrato.depth, now);
    lfo.connect(lfoGain);
    lfo.start(now);
    lfo.stop(now + total + 0.01);
  }

  // Create oscillator partials
  const oscs: OscillatorNode[] = [];
  for (const partial of oscPartials) {
    const osc = ctx.createOscillator();
    const partialGain = ctx.createGain();
    const baseFreq = Math.max(20, params.frequency * partial.ratio * pitchMult);

    osc.type = partial.type;
    osc.frequency.setValueAtTime(baseFreq, now);

    if (partial.detune !== undefined) {
      osc.detune.setValueAtTime(partial.detune, now);
    }

    // Pitch glide
    if (params.glide) {
      const glideFrom = Math.max(20, baseFreq * params.glide.from);
      const glideTo = Math.max(20, baseFreq * params.glide.to);
      osc.frequency.setValueAtTime(glideFrom, now);
      osc.frequency.exponentialRampToValueAtTime(glideTo, now + total);
    }

    // Connect vibrato LFO to this oscillator's frequency
    if (lfoGain) {
      lfoGain.connect(osc.frequency);
    }

    partialGain.gain.setValueAtTime(partial.gain, now);

    osc.connect(partialGain);
    partialGain.connect(masterGain);
    osc.start(now);
    osc.stop(now + total + 0.01);
    oscs.push(osc);
  }

  // Optional noise component
  if (params.noise) {
    const bufSize = Math.floor(ctx.sampleRate * total);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = params.noise.type;
    noiseFilter.frequency.setValueAtTime(params.noise.freq, now);
    if (params.noise.Q !== undefined) noiseFilter.Q.setValueAtTime(params.noise.Q, now);

    const noiseGain = ctx.createGain();
    const noisePeak = params.noise.volume * Math.max(0, Math.min(1, masterVolume));
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(noisePeak, now + params.attack);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + total);

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(outputDest);
    noiseSrc.start(now);
    noiseSrc.stop(now + total + 0.01);
  }
}

export interface SoundPackState {
  activePackId: SoundPackId;
  customPacks: SoundPack[];
}

export function createDefaultSoundPackState(): SoundPackState {
  return {
    activePackId: "default",
    customPacks: [],
  };
}

export class SoundPackEngine {
  private state: SoundPackState;

  constructor(initialState?: SoundPackState) {
    this.state = initialState ?? createDefaultSoundPackState();
  }

  getState(): SoundPackState {
    return { ...this.state, customPacks: [...this.state.customPacks] };
  }

  getAllPacks(): SoundPack[] {
    return [...BUILTIN_SOUND_PACKS, ...this.state.customPacks];
  }

  getActivePack(): SoundPack {
    const all = this.getAllPacks();
    return all.find(p => p.id === this.state.activePackId) ?? BUILTIN_SOUND_PACKS[0];
  }

  setActivePack(id: SoundPackId): boolean {
    const all = this.getAllPacks();
    if (!all.some(p => p.id === id)) return false;
    this.state.activePackId = id;
    return true;
  }

  addCustomPack(pack: SoundPack): void {
    this.state.customPacks.push({ ...pack, builtin: false });
  }

  removeCustomPack(id: SoundPackId): boolean {
    const idx = this.state.customPacks.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this.state.customPacks.splice(idx, 1);
    if (this.state.activePackId === id) {
      this.state.activePackId = "default";
    }
    return true;
  }

  getBuiltinPacks(): SoundPack[] {
    return [...BUILTIN_SOUND_PACKS];
  }

  getCustomPacks(): SoundPack[] {
    return [...this.state.customPacks];
  }

  reset(): void {
    this.state = createDefaultSoundPackState();
  }
}
