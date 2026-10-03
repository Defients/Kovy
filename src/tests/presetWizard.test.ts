// ============================================================
// Preset Wizard Tests
// ============================================================

import { describe, it, expect } from "vitest";
import {
  WIZARD_QUESTIONS,
  processWizardAnswers,
  getWizardStepCount,
  type WizardAnswers,
} from "@/settings/presetWizard";

describe("Preset Wizard", () => {
  it("has 7 questions", () => {
    expect(WIZARD_QUESTIONS).toHaveLength(7);
    expect(getWizardStepCount()).toBe(7);
  });

  it("each question has at least 2 choices", () => {
    for (const q of WIZARD_QUESTIONS) {
      expect(q.choices.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("processWizardAnswers returns defaults for empty answers", () => {
    const result = processWizardAnswers({});
    expect(result.behaviorPreset).toBe("curious");
    expect(result.visualPreset).toBe("balanced");
    expect(result.performancePreset).toBe("balanced");
    expect(result.audioEnabled).toBe(true);
    expect(result.motionDetection).toBe(true);
  });

  it("maps personality to behavior preset", () => {
    const result = processWizardAnswers({ personality: "chill" });
    expect(result.behaviorPreset).toBe("chill");
  });

  it("maps goblin personality", () => {
    const result = processWizardAnswers({ personality: "goblin" });
    expect(result.behaviorPreset).toBe("goblin");
  });

  it("maps visual style to visual preset", () => {
    const result = processWizardAnswers({ visual_style: "vibrant" });
    expect(result.visualPreset).toBe("high");
  });

  it("maps performance to performance preset", () => {
    const result = processWizardAnswers({ performance: "eco" });
    expect(result.performancePreset).toBe("battery");
  });

  it("maps sound silent to disabled audio", () => {
    const result = processWizardAnswers({ sound: "silent" });
    expect(result.audioEnabled).toBe(false);
    expect(result.audioVolume).toBe(0);
  });

  it("maps sound full to enabled audio", () => {
    const result = processWizardAnswers({ sound: "full" });
    expect(result.audioEnabled).toBe(true);
    expect(result.audioVolume).toBe(0.7);
  });

  it("maps privacy strict to disabled motion detection", () => {
    const result = processWizardAnswers({ privacy: "strict" });
    expect(result.motionDetection).toBe(false);
    expect(result.diagnosticsEnabled).toBe(false);
  });

  it("maps privacy open to enabled diagnostics", () => {
    const result = processWizardAnswers({ privacy: "open" });
    expect(result.diagnosticsEnabled).toBe(true);
  });

  it("applies scenario preset when selected", () => {
    const result = processWizardAnswers({ scenario: "calm" });
    expect(result.scenarioPresetId).toBe("calm");
  });

  it("does not apply scenario when none selected", () => {
    const result = processWizardAnswers({ scenario: "none" });
    expect(result.scenarioPresetId).toBeNull();
  });

  it("combines multiple answers", () => {
    const answers: WizardAnswers = {
      personality: "focus",
      activity_level: "low",
      visual_style: "minimal",
      performance: "eco",
      sound: "subtle",
      privacy: "balanced",
    };
    const result = processWizardAnswers(answers);
    expect(result.behaviorPreset).toBe("focus");
    expect(result.visualPreset).toBe("minimal");
    expect(result.performancePreset).toBe("battery");
    expect(result.audioVolume).toBe(0.3);
    expect(result.motionDetection).toBe(true);
  });
});
