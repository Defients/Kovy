// ============================================================
// Bond Meter & Legibility Tests
// ============================================================

import { describe, it, expect } from "vitest";
import {
  detectBondLevelUp,
  getBondLevelLabel,
  getBondLevelIndex,
  getBondLevelCount,
} from "@/overlay/bondMeter";
import type { BondLevel } from "@/store/types";

describe("Bond Legibility", () => {
  it("detectBondLevelUp detects upward transitions", () => {
    const result = detectBondLevelUp("stranger", "acquaintance");
    expect(result).not.toBeNull();
    expect(result!.fromLevel).toBe("stranger");
    expect(result!.toLevel).toBe("acquaintance");
  });

  it("detectBondLevelUp returns null for same level", () => {
    expect(detectBondLevelUp("friend", "friend")).toBeNull();
  });

  it("detectBondLevelUp returns null for downward transitions", () => {
    expect(detectBondLevelUp("friend", "acquaintance")).toBeNull();
  });

  it("detectBondLevelUp detects max level transition", () => {
    const result = detectBondLevelUp("friend", "best_friend");
    expect(result).not.toBeNull();
    expect(result!.toLevel).toBe("best_friend");
  });

  it("getBondLevelLabel returns human-readable labels", () => {
    expect(getBondLevelLabel("stranger")).toBe("Stranger");
    expect(getBondLevelLabel("best_friend")).toBe("Best Friend");
  });

  it("getBondLevelIndex returns correct index", () => {
    expect(getBondLevelIndex("stranger")).toBe(0);
    expect(getBondLevelIndex("acquaintance")).toBe(1);
    expect(getBondLevelIndex("companion")).toBe(2);
    expect(getBondLevelIndex("friend")).toBe(3);
    expect(getBondLevelIndex("best_friend")).toBe(4);
  });

  it("getBondLevelCount returns 5", () => {
    expect(getBondLevelCount()).toBe(5);
  });
});
