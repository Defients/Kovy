// ============================================================
// Kovy Audio Reactivity Engine — detects audio energy and beats
// from microphone input via getUserMedia and feeds mood, gaming,
// and visualizer layers. Uses Web Audio API AnalyserNode.
//
// Privacy-first: all analysis is local, no audio is recorded.
// Input source: microphone only (no system loopback).
// ============================================================

import type { AudioReactivityConfig, AudioVisualizerStyle } from "@/store/types";
import { clamp } from "@/lib/utils";

export interface AudioReactivityOutput {
  enabled: boolean;
  energy: number;          // 0-1, overall audio energy
  bassEnergy: number;      // 0-1, low-frequency energy
  midEnergy: number;       // 0-1, mid-frequency energy
  trebleEnergy: number;    // 0-1, high-frequency energy
  beatDetected: boolean;   // true on beat onset frame
  beatStrength: number;    // 0-1, strength of detected beat
  visualizerBars: number[]; // 0-1 per bar for visualizer rendering
  visualizerStyle: AudioVisualizerStyle;
}

export const NULL_AUDIO_OUTPUT: AudioReactivityOutput = {
  enabled: false,
  energy: 0,
  bassEnergy: 0,
  midEnergy: 0,
  trebleEnergy: 0,
  beatDetected: false,
  beatStrength: 0,
  visualizerBars: [],
  visualizerStyle: "bars",
};

const NUM_BARS = 32;

export class AudioReactivityEngine {
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private freqData: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private timeData: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private prevBassEnergy = 0;
  private beatCooldown = 0;

  async init(): Promise<boolean> {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      this.audioContext = new AudioCtx();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      this.mediaStream = stream;
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.7;
      source.connect(this.analyser);
      this.freqData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      this.timeData = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
      return true;
    } catch {
      return false;
    }
  }

  update(dt: number, config: AudioReactivityConfig): AudioReactivityOutput {
    if (!config.enabled || !this.analyser) {
      return { ...NULL_AUDIO_OUTPUT, visualizerStyle: config.visualizerStyle };
    }

    this.analyser.getByteFrequencyData(this.freqData);
    this.analyser.getByteTimeDomainData(this.timeData);

    const len = this.freqData.length;
    const bassEnd = Math.floor(len * 0.1);
    const midEnd = Math.floor(len * 0.4);

    let bassSum = 0, midSum = 0, trebleSum = 0;
    for (let i = 0; i < bassEnd; i++) bassSum += this.freqData[i];
    for (let i = bassEnd; i < midEnd; i++) midSum += this.freqData[i];
    for (let i = midEnd; i < len; i++) trebleSum += this.freqData[i];

    const bassEnergy = (bassSum / bassEnd / 255) * config.sensitivity;
    const midEnergy = (midSum / (midEnd - bassEnd) / 255) * config.sensitivity;
    const trebleEnergy = (trebleSum / (len - midEnd) / 255) * config.sensitivity;
    const energy = (bassEnergy + midEnergy + trebleEnergy) / 3;

    // Beat detection: look for bass energy spike
    this.beatCooldown = Math.max(0, this.beatCooldown - dt);
    let beatDetected = false;
    let beatStrength = 0;
    if (config.beatDetection && this.beatCooldown <= 0) {
      const threshold = this.prevBassEnergy * 1.4 + 0.05;
      if (bassEnergy > threshold && bassEnergy > 0.15) {
        beatDetected = true;
        beatStrength = clamp(bassEnergy - this.prevBassEnergy, 0, 1);
        this.beatCooldown = 0.15; // 150ms minimum between beats
      }
    }
    this.prevBassEnergy = bassEnergy;

    // Visualizer bars — only compute if feedVisualizer is enabled and style is not "none"
    const bars: number[] = [];
    if (config.feedVisualizer && config.visualizerStyle !== "none") {
      const step = Math.floor(len / NUM_BARS);
      for (let i = 0; i < NUM_BARS; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += this.freqData[i * step + j];
        }
        bars.push(clamp((sum / step / 255) * config.sensitivity, 0, 1));
      }
    }

    return {
      enabled: true,
      energy: clamp(energy, 0, 1),
      bassEnergy: clamp(bassEnergy, 0, 1),
      midEnergy: clamp(midEnergy, 0, 1),
      trebleEnergy: clamp(trebleEnergy, 0, 1),
      beatDetected,
      beatStrength,
      visualizerBars: bars,
      visualizerStyle: config.visualizerStyle,
    };
  }

  dispose(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
  }
}
