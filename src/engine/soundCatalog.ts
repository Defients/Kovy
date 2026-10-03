// ============================================================
// Kovy Sound Catalog — procedural Web Audio sound definitions
// Each entry: id, category, triggers, synthesizer parameters
// No external audio files — all synthesized via oscillators
// ============================================================

import type { SoundCategory, BehaviorState, SurfaceMood } from "@/store/types";
import type { SoundPackKey } from "./soundPackEngine";

export interface SoundDef {
  id: string;
  name: string;
  category: SoundCategory;
  description: string;
  behaviorTriggers: BehaviorState[];
  moodTriggers: SurfaceMood[];
  play: (ctx: AudioContext, dest: AudioNode, volume: number, pitchMult: number) => void;
  soundPackKey?: SoundPackKey;
}

function osc(
  ctx: AudioContext, dest: AudioNode,
  type: OscillatorType, freqStart: number, freqEnd: number,
  vol: number, attack: number, decay: number, pitchMult: number,
  filterFreq?: number,
): void {
  const now = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freqStart * pitchMult, now);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd * pitchMult), now + attack + decay);
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(vol, now + attack);
  g.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);

  if (filterFreq !== undefined) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(filterFreq, now);
    f.Q.setValueAtTime(1, now);
    o.connect(g);
    g.connect(f);
    f.connect(dest);
  } else {
    o.connect(g);
    g.connect(dest);
  }

  o.start(now);
  o.stop(now + attack + decay + 0.01);
}

function arpeggio(
  ctx: AudioContext, dest: AudioNode,
  freqs: number[], type: OscillatorType,
  vol: number, noteLen: number, gap: number, pitchMult: number
): void {
  const now = ctx.currentTime;
  freqs.forEach((freq, i) => {
    const t = now + i * gap;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq * pitchMult, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + noteLen);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + noteLen + 0.01);
  });
}

export const SOUND_CATALOG: SoundDef[] = [
  {
    id: "chirp",
    name: "Chirp",
    category: "reaction",
    description: "Short rising tone when inspecting",
    behaviorTriggers: ["inspect", "dash_inspect"],
    moodTriggers: [],
    play: (ctx, dest, vol, pm) => {
      osc(ctx, dest, "sine", 800, 1100, vol * 0.3, 0.04, 0.11, pm, 2500);
      osc(ctx, dest, "triangle", 1600, 2200, vol * 0.1, 0.04, 0.11, pm, 3000);
    },
    soundPackKey: "poke",
  },
  {
    id: "ping",
    name: "Ping",
    category: "reaction",
    description: "Clean bell-like ping on celebration",
    behaviorTriggers: ["celebrate"],
    moodTriggers: [],
    play: (ctx, dest, vol, pm) => {
      osc(ctx, dest, "sine", 1400, 1400, vol * 0.2, 0.01, 0.29, pm, 3000);
      osc(ctx, dest, "sine", 2100, 2100, vol * 0.08, 0.01, 0.29, pm, 3500);
    },
    soundPackKey: "celebrate",
  },
  {
    id: "pop",
    name: "Pop",
    category: "reaction",
    description: "Quick pop on startle",
    behaviorTriggers: ["startle"],
    moodTriggers: [],
    play: (ctx, dest, vol, pm) => {
      osc(ctx, dest, "sine", 600, 200, vol * 0.2, 0.01, 0.07, pm, 2000);
      osc(ctx, dest, "square", 300, 150, vol * 0.08, 0.001, 0.05, pm, 1500);
    },
    soundPackKey: "startle",
  },
  {
    id: "hum",
    name: "Hum",
    category: "mood",
    description: "Soft ambient hum for napping",
    behaviorTriggers: ["nap"],
    moodTriggers: [],
    soundPackKey: "nap",
    play: (ctx, dest, vol, pm) => {
      const now = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(300 * pm, now);
      o.frequency.linearRampToValueAtTime(350 * pm, now + 0.4);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(vol * 0.15, now + 0.1);
      g.gain.linearRampToValueAtTime(0, now + 0.5);
      o.connect(g);
      g.connect(dest);
      o.start(now);
      o.stop(now + 0.51);
    },
  },
  {
    id: "settle",
    name: "Settle",
    category: "reaction",
    description: "Descending tone for perching",
    behaviorTriggers: ["perch", "snap_perch"],
    moodTriggers: [],
    play: (ctx, dest, vol, pm) => {
      osc(ctx, dest, "sine", 600, 300, vol * 0.15, 0.02, 0.23, pm, 2000);
      osc(ctx, dest, "triangle", 300, 200, vol * 0.08, 0.02, 0.2, pm, 1500);
    },
    soundPackKey: "stretch",
  },
  {
    id: "wake",
    name: "Wake",
    category: "reaction",
    description: "Rising arpeggio for waking up",
    behaviorTriggers: [],
    moodTriggers: [],
    play: (ctx, dest, vol, pm) => arpeggio(ctx, dest, [400, 600, 800], "sine", vol * 0.2, 0.15, 0.08, pm),
    soundPackKey: "yawn",
  },
  {
    id: "purr",
    name: "Purr",
    category: "mood",
    description: "Low vibrato hum when calm and comfortable",
    behaviorTriggers: [],
    moodTriggers: ["calm"],
    soundPackKey: "nap",
    play: (ctx, dest, vol, pm) => {
      const now = ctx.currentTime;
      const o = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(180 * pm, now);
      lfo.frequency.setValueAtTime(6, now);
      lfoGain.gain.setValueAtTime(12, now);
      lfo.connect(lfoGain);
      lfoGain.connect(o.frequency);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(vol * 0.1, now + 0.15);
      g.gain.linearRampToValueAtTime(0, now + 0.6);
      o.connect(g);
      g.connect(dest);
      o.start(now);
      lfo.start(now);
      o.stop(now + 0.61);
      lfo.stop(now + 0.61);
    },
  },
  {
    id: "trill",
    name: "Trill",
    category: "mood",
    description: "Rapid ascending flutter when excited",
    behaviorTriggers: [],
    moodTriggers: ["excited"],
    play: (ctx, dest, vol, pm) => arpeggio(ctx, dest, [600, 900, 1100, 1300], "sine", vol * 0.15, 0.08, 0.05, pm),
    soundPackKey: "celebrate",
  },
  {
    id: "whisper",
    name: "Whisper",
    category: "mood",
    description: "Breathy white-noise brush when shy",
    behaviorTriggers: [],
    moodTriggers: ["shy"],
    soundPackKey: "hover",
    play: (ctx, dest, vol, _pm) => {
      const now = ctx.currentTime;
      const bufSize = ctx.sampleRate * 0.3;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(2000, now);
      bp.Q.setValueAtTime(3, now);
      g.gain.setValueAtTime(vol * 0.08, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      src.connect(bp);
      bp.connect(g);
      g.connect(dest);
      src.start(now);
    },
  },
  {
    id: "yawn",
    name: "Yawn",
    category: "mood",
    description: "Slow descending glide when sleepy",
    behaviorTriggers: ["yawn"],
    moodTriggers: ["sleepy"],
    play: (ctx, dest, vol, pm) => {
      osc(ctx, dest, "sine", 500, 250, vol * 0.1, 0.1, 0.4, pm, 1800);
      osc(ctx, dest, "triangle", 250, 150, vol * 0.05, 0.1, 0.35, pm, 1200);
    },
    soundPackKey: "yawn",
  },
  {
    id: "stretch",
    name: "Stretch",
    category: "reaction",
    description: "Soft extension tone when stretching",
    behaviorTriggers: ["stretch"],
    moodTriggers: [],
    play: (ctx, dest, vol, pm) => {
      osc(ctx, dest, "sine", 300, 300, vol * 0.15, 0.05, 0.25, pm, 2000);
      osc(ctx, dest, "triangle", 450, 450, vol * 0.06, 0.05, 0.2, pm, 2500);
    },
    soundPackKey: "stretch",
  },
  {
    id: "giggle",
    name: "Giggle",
    category: "mood",
    description: "Bouncy rapid notes when playful",
    behaviorTriggers: [],
    moodTriggers: ["playful"],
    play: (ctx, dest, vol, pm) => arpeggio(ctx, dest, [700, 900, 700, 1000], "sine", vol * 0.12, 0.06, 0.07, pm),
    soundPackKey: "celebrate",
  },
  {
    id: "gasp",
    name: "Gasp",
    category: "reaction",
    description: "Sharp inhale-like burst when overwhelmed",
    behaviorTriggers: [],
    moodTriggers: ["overwhelmed"],
    play: (ctx, dest, vol, pm) => {
      osc(ctx, dest, "sine", 400, 900, vol * 0.2, 0.02, 0.08, pm);
      osc(ctx, dest, "sine", 1200, 800, vol * 0.1, 0.03, 0.12, pm);
    },
    soundPackKey: "startle",
  },
  {
    id: "curious_blip",
    name: "Curious Blip",
    category: "reaction",
    description: "Double-note inquisitive sound",
    behaviorTriggers: ["chain_seek", "peek"],
    moodTriggers: ["curious"],
    play: (ctx, dest, vol, pm) => arpeggio(ctx, dest, [600, 800], "sine", vol * 0.15, 0.1, 0.12, pm),
    soundPackKey: "poke",
  },
  {
    id: "orbit_tone",
    name: "Orbit Tone",
    category: "ambient",
    description: "Gentle sustained note while orbiting",
    behaviorTriggers: ["orbit", "burst_orbit"],
    moodTriggers: [],
    soundPackKey: "wander",
    play: (ctx, dest, vol, pm) => {
      const now = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(440 * pm, now);
      o.frequency.linearRampToValueAtTime(460 * pm, now + 0.3);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(vol * 0.06, now + 0.08);
      g.gain.linearRampToValueAtTime(0, now + 0.4);
      o.connect(g);
      g.connect(dest);
      o.start(now);
      o.stop(now + 0.41);
    },
  },
  {
    id: "dream_chime",
    name: "Dream Chime",
    category: "ambient",
    description: "Ethereal bell-like tone during dreams",
    behaviorTriggers: ["dream"],
    moodTriggers: [],
    soundPackKey: "dream",
    play: (ctx, dest, vol, pm) => {
      const now = ctx.currentTime;
      [1, 1.5, 2].forEach((mult, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(800 * mult * pm, now + i * 0.1);
        g.gain.setValueAtTime(vol * 0.08 / (i + 1), now + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.5);
        o.connect(g);
        g.connect(dest);
        o.start(now + i * 0.1);
        o.stop(now + i * 0.1 + 0.51);
      });
    },
  },
  {
    id: "follow_whoosh",
    name: "Follow Whoosh",
    category: "reaction",
    description: "Quick swept noise on follow burst",
    behaviorTriggers: ["follow_burst"],
    moodTriggers: [],
    play: (ctx, dest, vol, pm) => {
      osc(ctx, dest, "sawtooth", 300, 100, vol * 0.06, 0.02, 0.12, pm, 1500);
      osc(ctx, dest, "sine", 150, 80, vol * 0.04, 0.02, 0.1, pm, 1000);
    },
    soundPackKey: "swipe",
  },
  {
    id: "social_chirp",
    name: "Social Chirp",
    category: "social",
    description: "Bright two-note call during family chase",
    behaviorTriggers: [],
    moodTriggers: [],
    play: (ctx, dest, vol, pm) => arpeggio(ctx, dest, [900, 1200], "sine", vol * 0.12, 0.08, 0.1, pm),
    soundPackKey: "celebrate",
  },
  {
    id: "comfort_hum",
    name: "Comfort Hum",
    category: "social",
    description: "Warm tone during family comfort contagion",
    behaviorTriggers: [],
    moodTriggers: [],
    play: (ctx, dest, vol, pm) => {
      osc(ctx, dest, "triangle", 250, 280, vol * 0.06, 0.1, 0.35, pm, 1500);
      osc(ctx, dest, "sine", 125, 140, vol * 0.04, 0.1, 0.3, pm, 1000);
    },
    soundPackKey: "nap",
  },
  {
    id: "wander_note",
    name: "Wander Note",
    category: "ambient",
    description: "Soft random-pitch note while wandering",
    behaviorTriggers: ["wander", "look_around"],
    moodTriggers: [],
    play: (ctx, dest, vol, pm) => {
      const freq = 350 + Math.random() * 200;
      osc(ctx, dest, "sine", freq, freq * 0.9, vol * 0.05, 0.05, 0.25, pm);
    },
    soundPackKey: "wander",
  },
  {
    id: "focus_drone",
    name: "Focus Drone",
    category: "mood",
    description: "Low steady tone when deeply focused",
    behaviorTriggers: ["meditate"],
    moodTriggers: ["focused"],
    soundPackKey: "nap",
    play: (ctx, dest, vol, pm) => {
      const now = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(200 * pm, now);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(vol * 0.05, now + 0.15);
      g.gain.linearRampToValueAtTime(0, now + 0.5);
      o.connect(g);
      g.connect(dest);
      o.start(now);
      o.stop(now + 0.51);
    },
  },
];

export function getSoundById(id: string): SoundDef | undefined {
  return SOUND_CATALOG.find(s => s.id === id);
}

export function getSoundsByCategory(category: SoundCategory): SoundDef[] {
  return SOUND_CATALOG.filter(s => s.category === category);
}

export function getSoundsForBehavior(behavior: BehaviorState): SoundDef[] {
  return SOUND_CATALOG.filter(s => s.behaviorTriggers.includes(behavior));
}

export function getSoundsForMood(mood: SurfaceMood): SoundDef[] {
  return SOUND_CATALOG.filter(s => s.moodTriggers.includes(mood));
}
