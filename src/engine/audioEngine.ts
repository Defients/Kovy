// ============================================================
// Kovy Audio Engine — Web Audio API synthesized sounds
// Privacy-first: no audio recording, no network, local-only
// ============================================================

import type { AudioConfig, SurfaceMood, BehaviorState, EntityId, SoundCategory } from "@/store/types";
import { SOUND_CATALOG, getSoundsForBehavior, getSoundsForMood, type SoundDef } from "./soundCatalog";
import { playSoundPack, type SoundPack } from "./soundPackEngine";

type SoundType = "chirp" | "ping" | "pop" | "hum" | "settle" | "wake";

interface AudioEngineState {
  ctx: AudioContext | null;
  masterGain: GainNode | null;
  initialized: boolean;
  lastChirpTime: number;
  minChirpInterval: number; // ms between chirps to avoid annoyance
  entityChirpTimes: Map<EntityId, number>; // per-entity cooldown
  lastGlobalSoundTime: number; // global cooldown tracking
  lastCategorySoundTime: Map<SoundCategory, number>;
  activeSoundPack: SoundPack | null;
}

const state: AudioEngineState = {
  ctx: null,
  masterGain: null,
  initialized: false,
  lastChirpTime: 0,
  minChirpInterval: 2000,
  entityChirpTimes: new Map(),
  lastGlobalSoundTime: 0,
  lastCategorySoundTime: new Map(),
  activeSoundPack: null,
};

function ensureContext(): AudioContext | null {
  if (state.ctx && state.ctx.state !== "closed") return state.ctx;
  try {
    state.ctx = new AudioContext();
    state.masterGain = state.ctx.createGain();
    state.masterGain.connect(state.ctx.destination);
    state.initialized = true;
    return state.ctx;
  } catch {
    return null;
  }
}

/** Set the active sound pack used for behavior/mood sounds */
export function setSoundPack(soundPack: SoundPack | null): void {
  state.activeSoundPack = soundPack;
}

/** Set master volume (0-1) */
export function setAudioVolume(volume: number): void {
  if (state.masterGain) {
    state.masterGain.gain.setValueAtTime(
      Math.max(0, Math.min(1, volume)),
      state.ctx?.currentTime ?? 0
    );
  }
}

/** Compute pitch multiplier from personality — creates a distinct voice per entity */
export function getPersonalityPitch(energyBias: number, hueOffset: number): number {
  // Energy biases pitch up, hue offset provides unique tonal identity
  return 1 + energyBias * 0.15 + (hueOffset / 360) * 0.1;
}

/** Play a synthesized sound using Web Audio API oscillators */
export function playSound(type: SoundType, volume: number = 0.3, pitchMult: number = 1): void {
  const ctx = ensureContext();
  if (!ctx || !state.masterGain) return;

  // Resume context if suspended (browser autoplay policy — silent catch: failure is non-critical, audio just won't play)
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(state.masterGain);

  switch (type) {
    case "chirp": {
      // Short rising tone — like a tiny bird chirp
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800 * pitchMult, now);
      osc.frequency.exponentialRampToValueAtTime(1200 * pitchMult, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(900 * pitchMult, now + 0.12);
      gain.gain.setValueAtTime(volume * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.15);
      break;
    }
    case "ping": {
      // Clean bell-like ping
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1400, now);
      gain.gain.setValueAtTime(volume * 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    }
    case "pop": {
      // Quick pop for UI interactions
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
      gain.gain.setValueAtTime(volume * 0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.08);
      break;
    }
    case "hum": {
      // Soft ambient hum for mood transitions
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(350, now + 0.4);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume * 0.15, now + 0.1);
      gain.gain.linearRampToValueAtTime(0, now + 0.5);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.5);
      break;
    }
    case "settle": {
      // Descending tone for perching/settling
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.2);
      gain.gain.setValueAtTime(volume * 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.25);
      break;
    }
    case "wake": {
      // Rising arpeggio for waking up
      const freqs = [400, 600, 800];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        const t = now + i * 0.08;
        osc.frequency.setValueAtTime(freq, t);
        const g = ctx.createGain();
        g.connect(gain);
        g.gain.setValueAtTime(volume * 0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(g);
        osc.start(t);
        osc.stop(t + 0.15);
      });
      gain.gain.setValueAtTime(1, now);
      break;
    }
  }
}

/** Check if a sound is enabled in config */
function isSoundEnabled(soundId: string, config: AudioConfig): boolean {
  if (config.soundEnables.length === 0) return true; // empty = all enabled
  const entry = config.soundEnables.find(e => e.id === soundId);
  return entry ? entry.enabled : true; // not listed = enabled by default
}

/** Get frequency multiplier for a category */
function getCategoryFrequency(category: SoundCategory, config: AudioConfig): number {
  switch (category) {
    case "ambient": return config.ambientFrequency;
    case "reaction": return config.reactionFrequency;
    case "mood": return config.moodFrequency;
    case "social": return config.reactionFrequency; // social uses reaction frequency
    case "ui": return 1; // UI sounds always at full frequency
    default: return 0.5;
  }
}

/** Play a catalog sound by definition */
export function playCatalogSound(sound: SoundDef, config: AudioConfig, pitchMult: number = 1, soundPack?: SoundPack): void {
  if (!isSoundEnabled(sound.id, config)) return;

  const now = Date.now();
  // Global cooldown
  if (now - state.lastGlobalSoundTime < config.globalCooldownMs) return;

  // Category frequency gate: roll against category frequency
  const freq = getCategoryFrequency(sound.category, config);
  if (Math.random() > freq) return;

  const ctx = ensureContext();
  if (!ctx || !state.masterGain) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {}); // autoplay policy — non-critical

  const activePack = soundPack ?? state.activeSoundPack;
  if (activePack && sound.soundPackKey) {
    const params = activePack.sounds[sound.soundPackKey];
    if (params) {
      playSoundPack(params, ctx, state.masterGain, config.volume, pitchMult);
    } else {
      sound.play(ctx, state.masterGain, config.volume, pitchMult);
    }
  } else {
    sound.play(ctx, state.masterGain, config.volume, pitchMult);
  }

  state.lastGlobalSoundTime = now;
  state.lastCategorySoundTime.set(sound.category, now);
}

/** Play a sound pack sound for a direct interaction event (hover/swipe) */
export function playInteractionSound(
  type: "hover" | "swipe",
  config: AudioConfig,
  pitchMult: number = 1,
): void {
  if (!config.kovySounds) return;
  const activePack = state.activeSoundPack;
  if (!activePack) return;

  const params = activePack.sounds[type];
  if (!params || params.volume <= 0 || params.duration <= 0) return;

  const ctx = ensureContext();
  if (!ctx || !state.masterGain) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {}); // autoplay policy — non-critical

  playSoundPack(params, ctx, state.masterGain, config.volume, pitchMult);
  state.lastGlobalSoundTime = Date.now();
}

/** Called by the behavior engine when state changes — plays mood/behavior-aware sounds */
export function onBehaviorChange(
  prevState: BehaviorState,
  newState: BehaviorState,
  mood: SurfaceMood,
  config: AudioConfig,
  entityId?: EntityId
): void {
  if (!config.kovySounds) return;

  const now = Date.now();
  // Per-entity rate limiting: siblings use their own cooldown
  if (entityId) {
    const lastTime = state.entityChirpTimes.get(entityId) ?? 0;
    if (now - lastTime < state.minChirpInterval) return;
    state.entityChirpTimes.set(entityId, now);
  } else {
    if (now - state.lastChirpTime < state.minChirpInterval) return;
    state.lastChirpTime = now;
  }

  // Wake-from-nap special case
  if (prevState === "nap" && newState !== "nap") {
    const wakeSnd = SOUND_CATALOG.find(s => s.id === "wake");
    if (wakeSnd) { playCatalogSound(wakeSnd, config); return; }
  }

  // Find behavior-triggered sounds
  const behaviorSounds = getSoundsForBehavior(newState);
  if (behaviorSounds.length > 0) {
    const snd = behaviorSounds[Math.floor(Math.random() * behaviorSounds.length)];
    playCatalogSound(snd, config);
    return;
  }

  // Fallback: mood-triggered sounds (lower priority)
  const moodSounds = getSoundsForMood(mood);
  if (moodSounds.length > 0) {
    const snd = moodSounds[Math.floor(Math.random() * moodSounds.length)];
    playCatalogSound(snd, config);
  }
}

/** Play a UI sound for settings interactions */
export function playUISound(action: "click" | "toggle" | "apply" | "cancel" | "tab", config: AudioConfig): void {
  if (!config.uiSounds) return;
  const vol = config.volume * 0.5; // UI sounds are quieter
  switch (action) {
    case "click": playSound("pop", vol); break;
    case "toggle": playSound("pop", vol * 0.8); break;
    case "apply": playSound("ping", vol); break;
    case "cancel": playSound("settle", vol * 0.7); break;
    case "tab": playSound("pop", vol * 0.5); break;
  }
}

/** Get the full sound catalog for UI display */
export function getSoundCatalog(): typeof SOUND_CATALOG {
  return SOUND_CATALOG;
}

/** Clean up audio context */
export function destroyAudio(): void {
  if (state.ctx && state.ctx.state !== "closed") {
    state.ctx.close().catch(() => {}); // best-effort cleanup — context may already be closed
  }
  state.ctx = null;
  state.masterGain = null;
  state.initialized = false;
  state.lastGlobalSoundTime = 0;
  state.lastCategorySoundTime.clear();
}

/** Check if audio is available */
export function isAudioAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return typeof AudioContext !== "undefined" || typeof window.webkitAudioContext !== "undefined";
}
