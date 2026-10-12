import { useState, useEffect } from "react";
import { useConfigStore } from "@/store/configStore";
import { KOVY_VERSION } from "@/lib/version";
import type { BehaviorPreset, VisualPreset, MonitorMode, ExperienceMode } from "@/store/types";

const STEPS = [
  "welcome",
  "mode",
  "privacy",
  "monitor",
  "behavior",
  "visual",
  "finish",
] as const;

type Step = (typeof STEPS)[number];

export function OnboardingFlow() {
  const [step, setStep] = useState<Step>("welcome");
  const [monitorMode, setMonitorMode] = useState<MonitorMode>("primary");
  const [behaviorPreset, setBehaviorPreset] = useState<BehaviorPreset>("curious");
  const [visualPreset, setVisualPreset] = useState<VisualPreset>("balanced");
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>("lite");

  const updateGeneral = useConfigStore((s) => s.updateDraftGeneral);
  const applyBehavior = useConfigStore((s) => s.applyBehaviorPresetToDraft);
  const applyVisual = useConfigStore((s) => s.applyVisualPresetToDraft);
  const setOnboardingComplete = useConfigStore((s) => s.setOnboardingComplete);
  const applyConfig = useConfigStore((s) => s.applyConfig);
  const setExperienceModeStore = useConfigStore((s) => s.setExperienceMode);

  const stepIndex = STEPS.indexOf(step);
  const isLast = step === "finish";
  const progressPercent = Math.round((stepIndex / (STEPS.length - 1)) * 100);

  const next = async () => {
    if (isLast) {
      updateGeneral({ monitorMode, experienceMode });
      applyBehavior(behaviorPreset);
      applyVisual(visualPreset);
      await setOnboardingComplete();
      await applyConfig();
      if (experienceMode === "lite") {
        await setExperienceModeStore("lite");
      }
      return;
    }
    const nextIdx = Math.min(stepIndex + 1, STEPS.length - 1);
    const nextStep = STEPS[nextIdx];
    if (nextStep === "visual" && experienceMode === "lite") {
      setStep("finish");
      return;
    }
    setStep(nextStep);
  };

  const prev = () => {
    const prevIdx = Math.max(stepIndex - 1, 0);
    setStep(STEPS[prevIdx]);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        next();
      } else if (e.key === "Backspace" && stepIndex > 0) {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [stepIndex]);

  return (
    <div className="flex items-center justify-center h-screen bg-kovy-bg" role="dialog" aria-modal="true" aria-label="Kovy setup wizard">
      <div className="w-[540px] kovy-glass p-8">
        {/* Progress dots + percentage */}
        <div className="flex items-center justify-center gap-2 mb-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              role="progressbar"
              aria-label={`Step ${i + 1} of ${STEPS.length}: ${s}`}
              aria-valuenow={i + 1}
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
              className={`rounded-full transition-all duration-300 ${
                i <= stepIndex
                  ? "bg-kovy-accent shadow-glow"
                  : "bg-kovy-border"
              } ${
                i === stepIndex ? "w-2.5 h-2.5" : "w-2 h-2"
              }`}
            />
          ))}
        </div>
        <div className="text-center text-[10px] text-kovy-text-dim mb-6">{progressPercent}% complete</div>

        {/* Step content */}
        <div className="min-h-[280px] animate-slide-in" key={step}>
          {step === "welcome" && <WelcomeStep />}
          {step === "mode" && (
            <ModeStep value={experienceMode} onChange={setExperienceMode} />
          )}
          {step === "privacy" && <PrivacyStep />}
          {step === "monitor" && (
            <MonitorStep value={monitorMode} onChange={setMonitorMode} />
          )}
          {step === "behavior" && (
            <BehaviorStep value={behaviorPreset} onChange={setBehaviorPreset} />
          )}
          {step === "visual" && (
            <VisualStep value={visualPreset} onChange={setVisualPreset} />
          )}
          {step === "finish" && <FinishStep />}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={prev}
            disabled={stepIndex === 0}
            className="kovy-btn-ghost disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Back
          </button>
          <button onClick={next} className="kovy-btn-primary">
            {isLast ? "Launch Kovy" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="text-center">
      <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-gradient-to-br from-kovy-accent to-kovy-cyan flex items-center justify-center shadow-glow-lg">
        <span className="text-white text-2xl font-bold">K</span>
      </div>
      <h2 className="text-xl font-semibold text-kovy-text mb-3">Welcome to Kovy {KOVY_VERSION}</h2>
      <p className="text-sm text-kovy-text-muted leading-relaxed max-w-sm mx-auto">
        Kovy is a curious, expressive little entity that lives on your desktop,
        watches for interesting things happening on your screen, and keeps you
        company while you work. It runs locally by default. If you enable AI,
        chat messages and the screen context you opt to share go to OpenRouter.
      </p>
      <div className="text-xs text-kovy-text-muted mt-4 max-w-sm mx-auto leading-relaxed grid grid-cols-2 gap-x-4 gap-y-1">
        <p><span className="text-kovy-cyan font-medium">Bond</span> — build a relationship over time</p>
        <p><span className="text-kovy-cyan font-medium">Thoughts & Whispers</span> — Kovy shares its mind</p>
        <p><span className="text-kovy-cyan font-medium">Focus Mode</span> — calms down when you're working</p>
        <p><span className="text-kovy-cyan font-medium">Gaming Mode</span> — kinetic adaptive visuals</p>
        <p><span className="text-kovy-cyan font-medium">Growth</span> — ages and grows with you</p>
        <p><span className="text-kovy-cyan font-medium">Drag & Profiles</span> — move Kovy, save presets</p>
      </div>
      <p className="text-xs text-kovy-text-dim mt-3 max-w-xs mx-auto">
        Let's set up a few things to make Kovy feel just right.
      </p>
    </div>
  );
}

function ModeStep({ value, onChange }: { value: ExperienceMode; onChange: (v: ExperienceMode) => void }) {
  const options: { value: ExperienceMode; label: string; desc: string; emoji: string }[] = [
    { value: "lite", label: "Simple", desc: "Just a cute companion. Pick a personality and vibe — Kovy handles the rest.", emoji: "🐾" },
    { value: "full", label: "Full Control", desc: "Access all 26+ settings tabs, fine-tune every feature, advanced presets.", emoji: "⚙️" },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold text-kovy-text mb-1 text-center">How do you want to use Kovy?</h2>
      <p className="text-xs text-kovy-text-dim text-center mb-5">You can switch between these anytime.</p>
      <div className="space-y-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`w-full text-left p-4 rounded-lg border transition-all duration-200 ${
              value === opt.value
                ? "border-kovy-accent/60 bg-kovy-accent/10 shadow-glow"
                : "border-kovy-border/40 bg-kovy-surface/40 hover:border-kovy-border"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
              <div>
                <div className="text-sm font-medium text-kovy-text">{opt.label}</div>
                <div className="text-xs text-kovy-text-dim mt-0.5 leading-relaxed">{opt.desc}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PrivacyStep() {
  return (
    <div>
      <h2 className="text-lg font-semibold text-kovy-text mb-3 text-center">Privacy First</h2>
      <div className="space-y-3 text-sm text-kovy-text-muted leading-relaxed">
        <p>
          Kovy analyzes motion <span className="text-kovy-cyan font-medium">locally on your device</span>.
          Optional AI sends chat messages and permitted context to OpenRouter. Screenshot sharing requires separate consent.
        </p>
        <div className="kovy-glass p-3 space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>Screen analysis is real-time, local-only</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>A previous downscaled grayscale frame stays briefly in memory for comparison; screenshots are not saved to disk</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>Memory Palace stores structured data locally (app sessions, mood patterns) — not screenshots</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>Muse Mode detects foreground app via process name only — no screen reading</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>No keystroke logging, no clipboard reading</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>Optional weather sends your configured location to wttr.in</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>Privacy Pause blocks new AI requests and cancels pending work. Data already sent cannot be recalled.</span>
          </div>
        </div>
        <p className="text-xs text-kovy-text-dim">
          You can review and adjust all privacy settings later.
        </p>
      </div>
    </div>
  );
}

function MonitorStep({ value, onChange }: { value: MonitorMode; onChange: (v: MonitorMode) => void }) {
  const options: { value: MonitorMode; label: string; desc: string }[] = [
    { value: "primary", label: "Primary Monitor", desc: "Kovy stays on your main display" },
    { value: "current", label: "Current Monitor", desc: "Kovy follows your cursor across monitors" },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold text-kovy-text mb-1 text-center">Monitor Behavior</h2>
      <p className="text-xs text-kovy-text-dim text-center mb-5">Which screen should Kovy live on?</p>
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`w-full text-left p-3.5 rounded-lg border transition-all duration-200 ${
              value === opt.value
                ? "border-kovy-accent/60 bg-kovy-accent/10 shadow-glow"
                : "border-kovy-border/40 bg-kovy-surface/40 hover:border-kovy-border"
            }`}
          >
            <div className="text-sm font-medium text-kovy-text">{opt.label}</div>
            <div className="text-xs text-kovy-text-dim mt-0.5">{opt.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function BehaviorStep({ value, onChange }: { value: BehaviorPreset; onChange: (v: BehaviorPreset) => void }) {
  const options: { value: BehaviorPreset; label: string; desc: string; emoji: string }[] = [
    { value: "chill", label: "Chill", desc: "Relaxed, prefers perching, low movement", emoji: "🌙" },
    { value: "curious", label: "Curious", desc: "Actively explores interesting screen regions", emoji: "✦" },
    { value: "goblin", label: "Goblin", desc: "Hyperactive, chases everything, never stops", emoji: "⚡" },
    { value: "hyper", label: "Hyper", desc: "Dashes between targets, chains moves, burst orbits", emoji: "🔥" },
    { value: "focus", label: "Focus Buddy", desc: "Stays focused on strong targets, minimal wandering", emoji: "◎" },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold text-kovy-text mb-1 text-center">Personality</h2>
      <p className="text-xs text-kovy-text-dim text-center mb-5">How should Kovy behave?</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`text-left p-3.5 rounded-lg border transition-all duration-200 ${
              value === opt.value
                ? "border-kovy-accent/60 bg-kovy-accent/10 shadow-glow"
                : "border-kovy-border/40 bg-kovy-surface/40 hover:border-kovy-border"
            }`}
          >
            <div className="text-lg mb-1">{opt.emoji}</div>
            <div className="text-sm font-medium text-kovy-text">{opt.label}</div>
            <div className="text-[10px] text-kovy-text-dim mt-0.5 leading-snug">{opt.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function VisualStep({ value, onChange }: { value: VisualPreset; onChange: (v: VisualPreset) => void }) {
  const options: { value: VisualPreset; label: string; desc: string }[] = [
    { value: "minimal", label: "Minimal", desc: "Clean and lightweight, fewer effects" },
    { value: "balanced", label: "Balanced", desc: "Good visuals with reasonable performance" },
    { value: "high", label: "Fancy", desc: "Rich particles, glow, and expressive animation" },
    { value: "ultra", label: "Ultra", desc: "Maximum visual fidelity, more GPU usage" },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold text-kovy-text mb-1 text-center">Visual Quality</h2>
      <p className="text-xs text-kovy-text-dim text-center mb-5">How pretty should Kovy look?</p>
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`w-full text-left p-3.5 rounded-lg border transition-all duration-200 ${
              value === opt.value
                ? "border-kovy-accent/60 bg-kovy-accent/10 shadow-glow"
                : "border-kovy-border/40 bg-kovy-surface/40 hover:border-kovy-border"
            }`}
          >
            <div className="text-sm font-medium text-kovy-text">{opt.label}</div>
            <div className="text-xs text-kovy-text-dim mt-0.5">{opt.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function FinishStep() {
  return (
    <div className="text-center">
      <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-gradient-to-br from-kovy-accent to-kovy-violet flex items-center justify-center shadow-glow-lg animate-glow-breathe">
        <span className="text-white text-2xl font-bold">K</span>
      </div>
      <h2 className="text-xl font-semibold text-kovy-text mb-3">All Set!</h2>
      <p className="text-sm text-kovy-text-muted leading-relaxed max-w-sm mx-auto">
        Kovy is ready to live on your desktop. You can adjust any of these settings
        later from the settings window.
      </p>
      <div className="text-xs text-kovy-text-dim mt-4 max-w-sm mx-auto space-y-1 kovy-glass p-3 border-kovy-border/30">
        <p><span className="text-kovy-accent font-mono">Alt+Shift+K</span> — show/hide Kovy</p>
        <p><span className="text-kovy-accent font-mono">Alt+Shift+M</span> — toggle Muse Mode</p>
        <p><span className="text-kovy-accent font-mono">Alt+Shift+G</span> — toggle Gaming Mode</p>
        <p><span className="text-kovy-accent font-mono">Alt+Shift+D</span> — toggle Drag Mode</p>
        <p><span className="text-kovy-accent font-mono">Alt+Shift+F</span> — toggle Focus Mode</p>
        <p><span className="text-kovy-accent font-mono">Alt+Shift+Tab</span> — switch Profiles</p>
        <p><span className="text-kovy-accent font-mono">Alt+Shift+L</span> — toggle Lite/Pro Mode</p>
      </div>
      <p className="text-xs text-kovy-text-dim mt-3">
        Explore the <span className="text-kovy-cyan">Bond</span>, <span className="text-kovy-cyan">Milestones</span>, <span className="text-kovy-cyan">Stats</span>, and <span className="text-kovy-cyan">Profiles</span> tabs to customize further.
      </p>
      <p className="text-xs text-kovy-text-dim mt-3">
        Right-click the tray icon for quick actions.
      </p>
    </div>
  );
}
