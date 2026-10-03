// ============================================================
// Kovy Thought Bubble Engine — spawns contextual thought bubbles
// above Kovy based on mood, behavior, and time of day.
//
// Thoughts are short text snippets that give Kovy inner voice.
// ============================================================

import type { ThoughtConfig, ThoughtStyle, SurfaceMood, BehaviorState, Vec2, BehaviorPreset, WeatherType, BondLevel, GrowthStage, FocusState } from "@/store/types";
import { clamp } from "@/lib/utils";

export type TimeOfDay = "morning" | "midday" | "afternoon" | "evening" | "late_night";
export type AppContext = "coding" | "writing" | "gaming" | "browsing" | "music" | "design" | "video" | "generic";

export interface ThoughtContext {
  timeOfDay?: TimeOfDay;
  bondLevel?: BondLevel;
  growthStage?: GrowthStage;
  season?: "spring" | "summer" | "autumn" | "winter";
  appContext?: AppContext;
  focusState?: FocusState;
}

export interface ThoughtBubble {
  id: number;
  text: string;
  position: Vec2;
  lifetime: number;
  maxLifetime: number;
  style: ThoughtStyle;
}

export interface ThoughtOutput {
  enabled: boolean;
  bubbles: ThoughtBubble[];
}

export const NULL_THOUGHT_OUTPUT: ThoughtOutput = {
  enabled: false,
  bubbles: [],
};

const MOOD_THOUGHTS: Record<SurfaceMood, string[]> = {
  calm: ["ahh, peaceful...", "nice and quiet", "this is nice"],
  curious: ["what's that?", "hmm, interesting...", "let me see..."],
  playful: ["wheee!", "tag, you're it!", "this is fun!"],
  focused: ["concentrating...", "in the zone", "deep focus..."],
  sleepy: ["so tired...", "*yawn*", "nap time..."],
  excited: ["wow!", "amazing!", "yes!!"],
  overwhelmed: ["too much...", "need a break", "overstimulated..."],
  shy: ["don't look at me...", "hiding now", "..."],
  content: ["all good", "feeling fine", "happy with this"],
  anxious: ["what if...", "something's wrong...", "worried..."],
  nostalgic: ["remember when...", "those were the days", "miss those times"],
  determined: ["I can do this!", "let's go!", "focus and succeed"],
};

const BEHAVIOR_THOUGHTS: Partial<Record<BehaviorState, string[]>> = {
  nap: ["zzz...", "dreaming...", "so cozy"],
  dream: ["in a faraway place...", "flying...", "dreaming of stars"],
  perch: ["nice view up here", "observing...", "good spot"],
  investigate: ["what's this?", "checking it out", "suspicious..."],
  meditate: ["om...", "breathing in...", "centering..."],
  hide: ["you can't see me", "hidden!", "stealth mode"],
  dance: ["feel the rhythm!", "let's dance!", "groovy!"],
  play_dead: ["I'm not here", "playing dead", "..."],
};

const PERSONALITY_THOUGHTS: Partial<Record<BehaviorPreset, string[]>> = {
  chill: ["just vibing", "all is well", "no rush..."],
  curious: ["wonder what's over there", "tell me more!", "ooh, shiny!"],
  goblin: ["hehehe", "mine!", "chaos time!"],
  hyper: ["GO GO GO", "can't stop won't stop", "zoom zoom zoom!"],
  focus: ["shhh, working", "do not disturb", "in the flow"],
};

const WEATHER_THOUGHTS: Partial<Record<WeatherType, string[]>> = {
  rain: ["rainy day...", "listen to the rain", "puddles!", "perfect nap weather", "rain is nice"],
  storm: ["whoa, storm!", "thunder!", "stay safe...", "nature is powerful"],
  snow: ["snow!", "so pretty...", "winter wonderland", "catching snowflakes!"],
  fog: ["can't see much...", "mysterious fog", "where am I?", "like a dream..."],
  aurora: ["beautiful lights!", "aurora...", "magical sky", "nature's fireworks"],
  clear: ["nice weather", "sunny day", "clear skies", "perfect day"],
  cloudy: ["cloudy...", "cozy overcast", "grey sky today", "cloud watching..."],
  wind: ["windy!", "blowing away!", "breezy", "wind in my... whatever I have"],
};

// --- Time of day thoughts ---
const TIME_OF_DAY_THOUGHTS: Record<TimeOfDay, string[]> = {
  morning: ["good morning!", "fresh start", "ready for the day", "morning energy!", "new day, new adventures"],
  midday: ["peak energy!", "lots to do!", "sun is high", "feeling productive", "middle of the day already?"],
  afternoon: ["post-lunch drowsy...", "afternoon slump", "still going", "almost evening", "getting sleepy..."],
  evening: ["winding down", "good evening", "day's almost over", "time to relax", "evening calm"],
  late_night: ["it's late...", "should we sleep?", "deep thoughts at night", "the world is quiet now", "stars are beautiful"],
};

// --- Bond level thoughts ---
const BOND_LEVEL_THOUGHTS: Record<BondLevel, string[]> = {
  stranger: ["...who are you?", "getting to know you", "still figuring you out", "cautious but curious"],
  acquaintance: ["starting to warm up", "you seem nice", "getting comfortable", "hi again!"],
  companion: ["glad you're here", "feeling safe with you", "you're good company", "this is nice"],
  friend: ["always happy to see you!", "you understand me", "best company", "missed you!"],
  best_friend: ["couldn't do this without you", "you mean everything to me", "always by your side", "forever grateful for you"],
};

// --- Growth stage thoughts ---
const GROWTH_STAGE_THOUGHTS: Record<GrowthStage, string[]> = {
  sprout: ["everything is so new!", "what's this? what's that?", "big world out there", "still growing...", "first time seeing this!"],
  young: ["full of energy!", "let's explore!", "growing stronger", "so much to learn!", "ready for anything!"],
  mature: ["feeling settled", "seen a lot of things", "comfortable in my skin", "wise-ish", "been around the block"],
  elder: ["ah, memories...", "seen it all before", "wisdom comes with time", "the old days were good", "still here, still going"],
};

// --- Seasonal thoughts ---
const SEASONAL_THOUGHTS: Record<string, string[]> = {
  spring: ["spring is here!", "everything is blooming", "fresh beginnings", "flowers everywhere", "spring cleaning? no thanks"],
  summer: ["summer vibes!", "warm and bright", "adventure time", "perfect weather for exploring", "sunshine!"],
  autumn: ["cozy autumn", "leaves are falling", "pumpkin season!", "crisp air", "getting chilly..."],
  winter: ["brr, cold!", "winter is here", "hibernate mode", "snow is pretty though", "stay warm!"],
};

// --- App context thoughts ---
const APP_CONTEXT_THOUGHTS: Record<AppContext, string[]> = {
  coding: ["ooh, code!", "looks complicated...", "you're a wizard!", "syntax looks nice", "debugging? you got this"],
  writing: ["words flowing!", "inspiring stuff", "you're a great writer", "tell me more!", "creative juices"],
  gaming: ["gaming time!", "let's go!", "I believe in you!", "clutch it!", "this is intense!"],
  browsing: ["what are we looking at?", "internet rabbit hole?", "interesting stuff", "clicking away", "scroll scroll scroll"],
  music: ["nice tune!", "grooving!", "music is life", "feel the beat", "this song is great"],
  design: ["pretty colors!", "good eye for design", "making things beautiful", "creative!", "nice composition"],
  video: ["watching something good?", "ooh, movie time!", "nice video", "entertaining!", "plot twist!"],
  generic: ["what are you up to?", "busy busy", "working hard!", "keep it up", "you're doing things"],
};

// --- Focus state thoughts ---
const FOCUS_STATE_THOUGHTS: Partial<Record<FocusState, string[]>> = {
  light_focus: ["you're focused!", "concentrating...", "in the zone", "shhh, working"],
  deep_focus: ["deep focus mode", "don't disturb!", "total concentration", "flow state activated"],
};

let nextBubbleId = 0;

export class ThoughtEngine {
  private bubbles: ThoughtBubble[] = [];
  private spawnAccum = 0;
  private recentThoughts: string[] = [];
  private readonly RECENT_HISTORY_SIZE = 20;

  update(dt: number, config: ThoughtConfig, mood: SurfaceMood, behavior: BehaviorState, position: Vec2, personalityPreset?: BehaviorPreset, weather?: WeatherType, context?: ThoughtContext): ThoughtOutput {
    if (!config.enabled) return NULL_THOUGHT_OUTPUT;

    // Remove expired bubbles
    this.bubbles = this.bubbles.filter(b => {
      b.lifetime -= dt;
      return b.lifetime > 0;
    });

    // Limit max active
    if (this.bubbles.length >= config.maxActive) {
      return { enabled: true, bubbles: this.bubbles };
    }

    // Spawn new bubbles based on frequency
    this.spawnAccum += dt * config.frequency * 0.1;
    if (this.spawnAccum >= 1.0) {
      this.spawnAccum = 0;
      const text = this.pickThought(mood, behavior, config.customThoughts, personalityPreset, weather, context);
      if (text) {
        this.bubbles.push({
          id: nextBubbleId++,
          text,
          position: { x: position.x, y: position.y - 60 },
          lifetime: 4.0,
          maxLifetime: 4.0,
          style: config.style,
        });
        this.recentThoughts.push(text);
        if (this.recentThoughts.length > this.RECENT_HISTORY_SIZE) {
          this.recentThoughts.shift();
        }
      }
    }

    return { enabled: true, bubbles: this.bubbles };
  }

  private pickThought(mood: SurfaceMood, behavior: BehaviorState, custom: string[], personalityPreset?: BehaviorPreset, weather?: WeatherType, context?: ThoughtContext): string | null {
    const pool: string[] = [];
    const weights: number[] = [];

    // Custom thoughts (30% chance)
    if (custom.length > 0 && Math.random() < 0.3) {
      for (const t of custom) { pool.push(t); weights.push(1.0); }
    }

    // Context-aware thoughts (weighted higher when context is available)
    if (context) {
      if (context.timeOfDay) {
        const tod = TIME_OF_DAY_THOUGHTS[context.timeOfDay];
        if (tod) for (const t of tod) { pool.push(t); weights.push(0.6); }
      }
      if (context.bondLevel) {
        const bond = BOND_LEVEL_THOUGHTS[context.bondLevel];
        if (bond) for (const t of bond) { pool.push(t); weights.push(0.5); }
      }
      if (context.growthStage) {
        const growth = GROWTH_STAGE_THOUGHTS[context.growthStage];
        if (growth) for (const t of growth) { pool.push(t); weights.push(0.4); }
      }
      if (context.season) {
        const season = SEASONAL_THOUGHTS[context.season];
        if (season) for (const t of season) { pool.push(t); weights.push(0.3); }
      }
      if (context.appContext) {
        const app = APP_CONTEXT_THOUGHTS[context.appContext];
        if (app) for (const t of app) { pool.push(t); weights.push(0.4); }
      }
      if (context.focusState) {
        const focus = FOCUS_STATE_THOUGHTS[context.focusState];
        if (focus) for (const t of focus) { pool.push(t); weights.push(0.5); }
      }
    }

    // Personality thoughts (25% chance)
    if (personalityPreset) {
      const personalityThoughts = PERSONALITY_THOUGHTS[personalityPreset];
      if (personalityThoughts && Math.random() < 0.25) {
        for (const t of personalityThoughts) { pool.push(t); weights.push(1.0); }
      }
    }

    // Weather thoughts (20% chance)
    if (weather) {
      const weatherThoughts = WEATHER_THOUGHTS[weather];
      if (weatherThoughts && Math.random() < 0.2) {
        for (const t of weatherThoughts) { pool.push(t); weights.push(0.8); }
      }
    }

    // Mood thoughts (always in pool)
    const moodThoughts = MOOD_THOUGHTS[mood];
    if (moodThoughts) {
      for (const t of moodThoughts) { pool.push(t); weights.push(1.0); }
    }

    // Behavior thoughts (40% chance)
    const behaviorThoughts = BEHAVIOR_THOUGHTS[behavior];
    if (behaviorThoughts && Math.random() < 0.4) {
      for (const t of behaviorThoughts) { pool.push(t); weights.push(0.9); }
    }

    if (pool.length === 0) return null;

    // Filter out recent thoughts to avoid repeats
    let availableIndices = pool.map((_, i) => i).filter(i => !this.recentThoughts.includes(pool[i]));

    // If everything was recently used, allow repeats
    if (availableIndices.length === 0) availableIndices = pool.map((_, i) => i);

    // Weighted random selection from available
    const totalWeight = availableIndices.reduce((sum, i) => sum + weights[i], 0);
    let roll = Math.random() * totalWeight;
    for (const i of availableIndices) {
      roll -= weights[i];
      if (roll <= 0) return pool[i];
    }
    return pool[availableIndices[availableIndices.length - 1]];
  }

  spawnCustom(text: string, position: Vec2, style: ThoughtStyle): void {
    this.bubbles.push({
      id: nextBubbleId++,
      text,
      position: { x: position.x, y: position.y - 60 },
      lifetime: 5.0,
      maxLifetime: 5.0,
      style,
    });
  }

  clear(): void {
    this.bubbles = [];
  }
}
