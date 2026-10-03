import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SliderSetting } from "../components/SliderSetting";
import { InfoCard } from "../components/InfoCard";

export function BondTab() {
  const config = useConfigStore((s) => s.draftConfig.bond);
  const update = useConfigStore((s) => s.updateDraftBond);
  const resetSection = useConfigStore((s) => s.resetSection);

  return (
    <div className="space-y-2">
      <InfoCard title="Bond & Relationship">
        Kovy builds a relationship with you over time. Interactions like hovering near Kovy,
        swiping past, or poking (rapid cursor approach) earn bond points. Five bond levels —
        from Stranger to Best Friend — subtly warm Kovy's mood, increase trust and comfort,
        and make emotes more frequent. Bond decays slowly without interaction. All data is
        local only.
      </InfoCard>

      <SettingSection title="Enable" onReset={() => resetSection("bond")}>
        <SwitchSetting
          label="Bond system enabled"
          description="Track interactions and progress the relationship over time"
          checked={config.enabled}
          onChange={(v) => update({ enabled: v })}
        />
      </SettingSection>

      {config.enabled && (
        <>
          <SettingSection title="Interaction">
            <SliderSetting
              label="Interaction radius"
              description="How close the cursor needs to be to Kovy for interactions to register (pixels)"
              value={config.interactionRadius}
              min={30} max={150} step={5}
              onChange={(v) => update({ interactionRadius: v })}
              displayValue={`${config.interactionRadius}px`}
            />
            <SliderSetting
              label="Poke startle chance"
              description="Chance that a poke causes Kovy to startle vs celebrate (0 = always celebrate, 1 = always startle)"
              value={config.pokeStartleChance}
              min={0} max={1} step={0.05}
              onChange={(v) => update({ pokeStartleChance: v })}
              displayValue={`${Math.round(config.pokeStartleChance * 100)}%`}
            />
          </SettingSection>

          <SettingSection title="Decay">
            <SliderSetting
              label="Bond decay per day"
              description="How much bond points decay per day without any interaction (higher = faster forgetting)"
              value={config.bondDecayPerDay}
              min={0} max={0.05} step={0.005}
              onChange={(v) => update({ bondDecayPerDay: v })}
              displayValue={config.bondDecayPerDay.toFixed(3)}
            />
          </SettingSection>
        </>
      )}
    </div>
  );
}
