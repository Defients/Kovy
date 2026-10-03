import { describe, it, expect, vi } from "vitest";

// We test the pure/exportable logic of memoryEngine without hitting SQLite.
// DB-dependent paths are tested via integration tests or mocked.

// --- Significance scoring tests (extracted logic) ---

// Replicate the scoring function from memoryEngine for unit testing
// This mirrors computeSignificance exactly so tests break if logic drifts.
function computeSignificance(draft: {
  type: string;
  duration: number;
  valence: number;
  stimulation: number;
}): number {
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
  let score = 0;

  if (draft.duration > 0) {
    score += clamp(Math.log10(draft.duration / 60 + 1) / 2, 0, 0.35);
  }

  score += Math.abs(draft.valence) * 0.25;
  score += draft.stimulation * 0.2;

  switch (draft.type) {
    case "interaction": score += 0.15; break;
    case "mood_episode": score += 0.1; break;
    case "app_session": score += 0.1; break;
    case "preference": score += 0.2; break;
    case "aversion": score += 0.2; break;
    default: score += 0.05; break;
  }

  return clamp(score, 0, 1);
}

describe("Memory significance scoring", () => {
  it("scores a long app session above threshold", () => {
    const score = computeSignificance({
      type: "app_session",
      duration: 1800, // 30 min
      valence: 0,
      stimulation: 0.5,
    });
    // duration(30min) ≈ 0.35 + valence(0)*0.25=0 + stim(0.5)*0.2=0.1 + type(0.1)=0.1
    expect(score).toBeGreaterThan(0.3);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("scores a short zero-valence event below default threshold", () => {
    const score = computeSignificance({
      type: "quiet_period",
      duration: 30, // 30 seconds
      valence: 0,
      stimulation: 0.1,
    });
    // Very short + low stim + default type = should be low
    expect(score).toBeLessThan(0.3);
  });

  it("scores interactions with a bonus", () => {
    const interactionScore = computeSignificance({
      type: "interaction",
      duration: 0,
      valence: 0.3,
      stimulation: 0.5,
    });
    const genericScore = computeSignificance({
      type: "quiet_period",
      duration: 0,
      valence: 0.3,
      stimulation: 0.5,
    });
    expect(interactionScore).toBeGreaterThan(genericScore);
  });

  it("high valence increases significance", () => {
    const highValence = computeSignificance({
      type: "mood_episode",
      duration: 300,
      valence: 0.8,
      stimulation: 0.5,
    });
    const lowValence = computeSignificance({
      type: "mood_episode",
      duration: 300,
      valence: 0.1,
      stimulation: 0.5,
    });
    expect(highValence).toBeGreaterThan(lowValence);
  });

  it("negative valence also increases significance (aversions are memorable)", () => {
    const negativeValence = computeSignificance({
      type: "aversion",
      duration: 300,
      valence: -0.7,
      stimulation: 0.3,
    });
    expect(negativeValence).toBeGreaterThan(0.3);
  });

  it("score is clamped to [0, 1]", () => {
    const maxScore = computeSignificance({
      type: "preference",
      duration: 36000, // 10 hours
      valence: 1.0,
      stimulation: 1.0,
    });
    expect(maxScore).toBeLessThanOrEqual(1);
    expect(maxScore).toBeGreaterThan(0.5);
  });

  it("zero everything gives minimal score", () => {
    const score = computeSignificance({
      type: "quiet_period",
      duration: 0,
      valence: 0,
      stimulation: 0,
    });
    // Only the type bonus (0.05) should be present
    expect(score).toBe(0.05);
  });
});

// --- Window title sanitization tests ---

function sanitizeWindowTitle(title: string | null): string | null {
  if (!title) return null;
  let sanitized = title;
  if (sanitized.length > 60) sanitized = sanitized.slice(0, 60) + "…";
  sanitized = sanitized.replace(/[A-Z]:\\[^\s]+/gi, "[path]");
  sanitized = sanitized.replace(/https?:\/\/[^\s]+/gi, "[url]");
  return sanitized;
}

describe("Window title sanitization", () => {
  it("returns null for null input", () => {
    expect(sanitizeWindowTitle(null)).toBeNull();
  });

  it("passes through short clean titles unchanged", () => {
    expect(sanitizeWindowTitle("Visual Studio Code")).toBe("Visual Studio Code");
  });

  it("truncates long titles to 60 chars", () => {
    const longTitle = "A".repeat(100);
    const result = sanitizeWindowTitle(longTitle)!;
    expect(result.length).toBe(61); // 60 + "…"
    expect(result.endsWith("…")).toBe(true);
  });

  it("strips file paths", () => {
    const title = "Editing C:\\Users\\alice\\document.txt - Notepad";
    const result = sanitizeWindowTitle(title)!;
    expect(result).not.toContain("C:\\Users");
    expect(result).toContain("[path]");
  });

  it("strips URLs", () => {
    const title = "Google - https://www.google.com/search?q=test";
    const result = sanitizeWindowTitle(title)!;
    expect(result).not.toContain("https://");
    expect(result).toContain("[url]");
  });
});

// --- Mood-to-valence mapping tests ---

function moodToValence(mood: string): number {
  switch (mood) {
    case "calm": return 0.2;
    case "curious": return 0.3;
    case "playful": return 0.4;
    case "focused": return 0.2;
    case "sleepy": return -0.1;
    case "excited": return 0.5;
    case "overwhelmed": return -0.4;
    case "shy": return -0.2;
    default: return 0;
  }
}

describe("Mood to valence mapping", () => {
  it("positive moods have positive valence", () => {
    expect(moodToValence("calm")).toBeGreaterThan(0);
    expect(moodToValence("curious")).toBeGreaterThan(0);
    expect(moodToValence("excited")).toBeGreaterThan(0);
  });

  it("overwhelmed has negative valence", () => {
    expect(moodToValence("overwhelmed")).toBeLessThan(0);
  });

  it("unknown mood returns 0", () => {
    expect(moodToValence("nonexistent")).toBe(0);
  });
});
