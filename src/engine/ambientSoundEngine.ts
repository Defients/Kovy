// ============================================================
// Kovy Ambient Sound Engine — plays looping ambient soundscapes
// synced with weather or user preference. Uses Web Audio API.
// ============================================================

import type { AmbientSoundConfig, AmbientSoundType, WeatherType } from "@/store/types";
import { clamp } from "@/lib/utils";

export interface AmbientSoundOutput {
  enabled: boolean;
  currentSound: AmbientSoundType;
  volume: number;
}

export const NULL_AMBIENT_OUTPUT: AmbientSoundOutput = {
  enabled: false,
  currentSound: "silence",
  volume: 0,
};

const WEATHER_SOUND_MAP: Partial<Record<WeatherType, AmbientSoundType>> = {
  rain: "rain",
  storm: "rain",
  snow: "silence",
  fog: "forest",
  clear: "silence",
  cloudy: "silence",
};

// Procedural sound generation using oscillators and noise
export class AmbientSoundEngine {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private currentSource: AudioNode | null = null;
  private currentType: AmbientSoundType = "silence";

  private ensureContext(): AudioContext {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.gainNode.gain.value = 0;
    }
    return this.audioContext;
  }

  update(config: AmbientSoundConfig, weatherType?: WeatherType): AmbientSoundOutput {
    if (!config.enabled) {
      this.stop();
      return { ...NULL_AMBIENT_OUTPUT, volume: config.volume };
    }

    let targetSound = config.preferredSounds[0] ?? "silence";
    if (config.syncWithWeather && weatherType) {
      targetSound = WEATHER_SOUND_MAP[weatherType] ?? targetSound;
    }

    if (targetSound !== this.currentType) {
      this.stop();
      this.currentType = targetSound;
      this.play(targetSound, config.volume);
    } else if (this.gainNode && this.audioContext) {
      // Smoothly adjust volume
      const targetVol = clamp(config.volume, 0, 1) * 0.3;
      this.gainNode.gain.setTargetAtTime(targetVol, this.audioContext.currentTime, 0.5);
    }

    return {
      enabled: true,
      currentSound: this.currentType,
      volume: config.volume,
    };
  }

  private play(type: AmbientSoundType, volume: number): void {
    if (type === "silence") return;
    const ctx = this.ensureContext();
    const targetVol = clamp(volume, 0, 1) * 0.3;

    // Create a noise buffer for ambient sounds
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (type === "rain") {
      // White noise for rain
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }
    } else if (type === "ocean") {
      // Low-frequency noise for ocean
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.3 * Math.sin(i * 0.001);
      }
    } else {
      // Soft noise for forest/cafe
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.15;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Add a low-pass filter for softer sound
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = type === "rain" ? 4000 : type === "ocean" ? 500 : 2000;

    source.connect(filter);
    filter.connect(this.gainNode!);
    source.start();

    this.gainNode!.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.5);
    this.currentSource = source;
  }

  stop(): void {
    if (this.currentSource) {
      try { (this.currentSource as AudioBufferSourceNode).stop(); } catch { /* ignore */ }
      this.currentSource = null;
    }
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.3);
    }
    this.currentType = "silence";
  }

  dispose(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
