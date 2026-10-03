// ============================================================
// Kovy Whisper Engine — occasionally shows short messages
// as subtitles, speech bubbles, or popups. Categories include
// encouragement, humor, facts, and comfort.
// ============================================================

import type { WhisperConfig, WhisperStyle, Vec2, BehaviorPreset, BondLevel, FocusState, WeatherType } from "@/store/types";
import { clamp } from "@/lib/utils";
import type { TimeOfDay } from "./thoughtEngine";

export interface WhisperContext {
  timeOfDay?: TimeOfDay;
  bondLevel?: BondLevel;
  focusState?: FocusState;
  weather?: WeatherType;
  season?: "spring" | "summer" | "autumn" | "winter";
}

export interface WhisperMessage {
  id: number;
  text: string;
  category: "encouragement" | "humor" | "facts" | "comfort";
  position: Vec2;
  lifetime: number;
  maxLifetime: number;
  style: WhisperStyle;
}

export interface WhisperOutput {
  enabled: boolean;
  messages: WhisperMessage[];
}

export const NULL_WHISPER_OUTPUT: WhisperOutput = {
  enabled: false,
  messages: [],
};

const WHISPER_POOL: Record<string, string[]> = {
  encouragement: [
    "You've got this!",
    "Keep going, you're doing great!",
    "Every step counts.",
    "Believe in yourself!",
    "Progress, not perfection.",
    "You're stronger than you think.",
    "One day at a time.",
    "The hard part will pass.",
    "You're making a difference.",
    "Don't give up — breakthrough is close.",
    "Your effort matters, even on hard days.",
    "Small wins are still wins.",
    "You inspire the people around you.",
    "Today is another chance.",
    "Trust the process.",
  ],
  humor: [
    "Why did the chicken cross the road? To get to the other slide!",
    "I told my computer I needed a break, and it said 'No problem, I'll go to sleep.'",
    "Why don't programmers like nature? It has too many bugs.",
    "I'm not lazy, I'm on energy-saving mode.",
    "Why did the developer go broke? Because he used up all his cache!",
    "I would tell you a UDP joke, but you might not get it.",
    "There are 10 types of people: those who understand binary and those who don't.",
    "My code doesn't have bugs, it has unexpected features.",
    "I'm reading a book about anti-gravity. It's impossible to put down!",
    "Why do Java developers wear glasses? Because they don't C#.",
    "A SQL query walks into a bar, approaches two tables, and asks: 'Mind if I join you?'",
    "I tried to catch some fog earlier. I mist.",
    "Why did the scarecrow win an award? He was outstanding in his field!",
    "I named my dog 'Five Miles' so I can tell people I walk Five Miles every day.",
    "Parallel lines have so much in common. It's a shame they'll never meet.",
  ],
  facts: [
    "Did you know? Honey never spoils.",
    "Octopuses have three hearts.",
    "A day on Venus is longer than its year.",
    "Bananas are berries, but strawberries aren't.",
    "The first computer bug was an actual moth.",
    "Honeybees can recognize human faces.",
    "A group of flamingos is called a 'flamboyance'.",
    "The shortest war in history lasted 38 minutes.",
    "Wombat poop is cube-shaped.",
    "A bolt of lightning contains enough energy to toast 100,000 slices of bread.",
    "The Eiffel Tower can be 15cm taller during summer due to thermal expansion.",
    "There are more possible chess games than atoms in the universe.",
    "Dolphins give each other names and can call each other by name.",
    "A single cloud can weigh over a million pounds.",
    "The human brain uses about 20 watts of power — like a dim light bulb.",
  ],
  comfort: [
    "It's okay to take a break.",
    "You're enough just as you are.",
    "Tomorrow is a fresh start.",
    "Be kind to yourself today.",
    "Even the darkest night will end and the sun will rise.",
    "You don't have to have it all figured out right now.",
    "Rest is productive too.",
    "Your feelings are valid.",
    "It's okay to not be okay sometimes.",
    "You've survived 100% of your bad days so far.",
    "Be patient with yourself. Growth takes time.",
    "You are not your mistakes.",
    "It's okay to ask for help.",
    "Some days, just existing is enough.",
    "The world is better with you in it.",
  ],
};

// --- Time-of-day whispers ---
const TIME_OF_DAY_WHISPERS: Record<TimeOfDay, string[]> = {
  morning: ["Good morning! Let's make today great.", "Rise and shine!", "Morning energy — use it well!", "A new day, a new opportunity.", "Start the day with intention."],
  midday: ["Halfway through the day — keep going!", "Lunch break? Don't forget to eat!", "Peak productivity hours!", "You're in the groove.", "Keep that momentum going!"],
  afternoon: ["Afternoon slump? A short walk helps.", "Almost there — finish strong.", "A coffee might help right now...", "Don't forget to stretch!", "The day is yours."],
  evening: ["Good evening. Time to unwind.", "You did a lot today. Be proud.", "Evening is for reflection.", "Time to relax those shoulders.", "What went well today?"],
  late_night: ["It's getting late. Sleep is important too.", "The quiet of night is beautiful, isn't it?", "Late night thoughts hit different.", "Don't forget to rest.", "The stars are out tonight."],
};

// --- Bond level whispers ---
const BOND_LEVEL_WHISPERS: Record<BondLevel, string[]> = {
  stranger: ["Hi there. I'm Kovy.", "Getting to know you...", "Nice to meet you!", "I'm still learning about you."],
  acquaintance: ["Hey again! Good to see you.", "We're getting somewhere!", "I like having you around.", "Starting to feel comfortable."],
  companion: ["You're great company, you know that?", "I always feel better when you're here.", "Thanks for spending time with me.", "You make my day better."],
  friend: ["I'm so glad we're friends!", "You always know how to cheer me up.", "I look forward to seeing you every day.", "Friends like you are rare and precious."],
  best_friend: ["You're my favorite person, you know that?", "I couldn't imagine my days without you.", "Thank you for being you. Always.", "We've been through so much together. I'm grateful."],
};

// --- Weather whispers ---
const WEATHER_WHISPERS: Partial<Record<WeatherType, string[]>> = {
  rain: ["Rainy days are perfect for cozy thoughts.", "Listen to the rain — it's nature's lullaby.", "Rain brings new growth."],
  storm: ["Storms pass. This one will too.", "Nature showing off. Stay safe!", "After the storm comes the calm."],
  snow: ["Snow makes everything look magical.", "Winter wonderland outside!", "Each snowflake is unique, just like you."],
  clear: ["What a beautiful day!", "Perfect weather for anything.", "The sky is so blue today!"],
  fog: ["Fog makes everything mysterious.", "Can't see far, but that's okay. One step at a time."],
};

// --- Focus state whispers ---
const FOCUS_STATE_WHISPERS: Partial<Record<FocusState, string[]>> = {
  light_focus: ["You're in the zone. Nice!", "Focus looks good on you.", "Keep that concentration going."],
  deep_focus: ["Deep focus — I'll be quiet.", "You're in flow state. Incredible.", "I'll keep the distractions away."],
};

// --- Seasonal whispers ---
const SEASONAL_WHISPERS: Record<string, string[]> = {
  spring: ["Spring is a time for new beginnings.", "Everything is blooming, just like you.", "Fresh air, fresh ideas."],
  summer: ["Summer energy is contagious!", "Long days, big possibilities.", "Soak up that sunshine."],
  autumn: ["Autumn reminds us that change can be beautiful.", "Cozy season is the best season.", "Crunchy leaves underfoot."],
  winter: ["Winter is for rest and reflection.", "Stay warm — body and soul.", "Even in cold, there's warmth to be found."],
};

// --- Contextual prefixes (occasionally prepended) ---
const CONTEXTUAL_PREFIXES: string[] = [
  "On this rainy day...", "While you're working...", "It's been a while...",
  "Between you and me...", "Just thinking...", "You know...",
  "Can I just say...", "Honestly...", "Random thought:",
];

let nextWhisperId = 0;

const PERSONALITY_CATEGORY_WEIGHTS: Partial<Record<BehaviorPreset, Record<string, number>>> = {
  chill: { comfort: 1.5, encouragement: 1.0, humor: 0.7, facts: 0.5 },
  curious: { facts: 1.5, encouragement: 1.0, humor: 0.8, comfort: 0.7 },
  goblin: { humor: 1.8, facts: 0.6, encouragement: 0.5, comfort: 0.4 },
  hyper: { encouragement: 1.3, humor: 1.2, facts: 0.5, comfort: 0.6 },
  focus: { encouragement: 1.5, comfort: 1.2, facts: 0.8, humor: 0.5 },
};

export class WhisperEngine {
  private messages: WhisperMessage[] = [];
  private spawnAccum = 0;
  private recentMessages: string[] = [];
  private readonly RECENT_HISTORY_SIZE = 20;

  update(dt: number, config: WhisperConfig, position: Vec2, personalityPreset?: BehaviorPreset, context?: WhisperContext): WhisperOutput {
    if (!config.enabled) return NULL_WHISPER_OUTPUT;

    // Remove expired messages
    this.messages = this.messages.filter(m => {
      m.lifetime -= dt;
      return m.lifetime > 0;
    });

    // Spawn new messages
    this.spawnAccum += dt * config.frequency * 0.05;
    if (this.spawnAccum >= 1.0 && this.messages.length < 3) {
      this.spawnAccum = 0;
      const category = this.pickCategory(config.categories, personalityPreset);
      const text = this.pickMessage(category, config.customMessages, context);
      if (text) {
        this.messages.push({
          id: nextWhisperId++,
          text,
          category,
          position: { x: position.x, y: position.y - 80 },
          lifetime: 6.0,
          maxLifetime: 6.0,
          style: config.style,
        });
        this.recentMessages.push(text);
        if (this.recentMessages.length > this.RECENT_HISTORY_SIZE) {
          this.recentMessages.shift();
        }
      }
    }

    return { enabled: true, messages: this.messages };
  }

  clear(): void {
    this.messages = [];
  }

  spawnCustom(text: string, category: WhisperMessage["category"], position: Vec2, style: WhisperStyle): void {
    this.messages.push({
      id: nextWhisperId++,
      text,
      category,
      position: { x: position.x, y: position.y - 80 },
      lifetime: 7.0,
      maxLifetime: 7.0,
      style,
    });
  }

  private pickCategory(categories: string[], personalityPreset?: BehaviorPreset): WhisperMessage["category"] {
    const cats: WhisperMessage["category"][] = categories.length > 0
      ? categories as WhisperMessage["category"][]
      : ["encouragement"];
    if (!personalityPreset) {
      return cats[Math.floor(Math.random() * cats.length)];
    }
    const weights = PERSONALITY_CATEGORY_WEIGHTS[personalityPreset];
    if (!weights) {
      return cats[Math.floor(Math.random() * cats.length)];
    }
    const weighted = cats.map(cat => ({ cat, weight: weights[cat] ?? 1.0 }));
    const total = weighted.reduce((sum, w) => sum + w.weight, 0);
    let roll = Math.random() * total;
    for (const w of weighted) {
      roll -= w.weight;
      if (roll <= 0) return w.cat;
    }
    return weighted[weighted.length - 1].cat;
  }

  private pickMessage(category: WhisperMessage["category"], customMessages: string[], context?: WhisperContext): string | null {
    const pool: string[] = [];
    const weights: number[] = [];

    // Base category pool
    const basePool = WHISPER_POOL[category] ?? WHISPER_POOL.encouragement;
    for (const t of basePool) { pool.push(t); weights.push(1.0); }

    // Custom messages (30% chance)
    if (customMessages.length > 0 && Math.random() < 0.3) {
      for (const t of customMessages) { pool.push(t); weights.push(1.2); }
    }

    // Context-aware pools
    if (context) {
      if (context.timeOfDay) {
        const tod = TIME_OF_DAY_WHISPERS[context.timeOfDay];
        if (tod) for (const t of tod) { pool.push(t); weights.push(0.6); }
      }
      if (context.bondLevel) {
        const bond = BOND_LEVEL_WHISPERS[context.bondLevel];
        if (bond) for (const t of bond) { pool.push(t); weights.push(0.5); }
      }
      if (context.focusState) {
        const focus = FOCUS_STATE_WHISPERS[context.focusState];
        if (focus) for (const t of focus) { pool.push(t); weights.push(0.4); }
      }
      if (context.weather) {
        const weather = WEATHER_WHISPERS[context.weather];
        if (weather) for (const t of weather) { pool.push(t); weights.push(0.3); }
      }
      if (context.season) {
        const season = SEASONAL_WHISPERS[context.season];
        if (season) for (const t of season) { pool.push(t); weights.push(0.3); }
      }
    }

    if (pool.length === 0) return null;

    // Filter out recent messages
    let availableIndices = pool.map((_, i) => i).filter(i => !this.recentMessages.includes(pool[i]));
    if (availableIndices.length === 0) availableIndices = pool.map((_, i) => i);

    // Weighted selection
    const totalWeight = availableIndices.reduce((sum, i) => sum + weights[i], 0);
    let roll = Math.random() * totalWeight;
    let selected = pool[availableIndices[0]];
    for (const i of availableIndices) {
      roll -= weights[i];
      if (roll <= 0) { selected = pool[i]; break; }
    }

    // Occasionally add a contextual prefix (10% chance)
    if (Math.random() < 0.1) {
      const prefix = CONTEXTUAL_PREFIXES[Math.floor(Math.random() * CONTEXTUAL_PREFIXES.length)];
      selected = `${prefix} ${selected}`;
    }

    return selected;
  }
}
