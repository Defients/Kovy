import React from "react";
import ReactDOM from "react-dom/client";
import { SettingsApp } from "./settings/SettingsApp";
import { LiteSettingsApp } from "./settings/LiteSettingsApp";
import { useConfigStore } from "./store/configStore";
import "./index.css";
import { applyNativePolicy } from "./lib/nativePolicy";

// Only this settings entry point grants permissions; overlay previews cannot do so.
useConfigStore.subscribe((state, previous) => {
  if (state.loaded && (!previous.loaded || state.appliedConfig !== previous.appliedConfig)) {
    void applyNativePolicy(state.appliedConfig).catch(() => console.warn("Kovy: native policy could not be applied"));
  }
});

function AppRouter() {
  const experienceMode = useConfigStore((s) => s.appliedConfig.general.experienceMode);
  const loaded = useConfigStore((s) => s.loaded);

  if (!loaded) {
    return <SettingsApp />;
  }

  return experienceMode === "lite" ? <LiteSettingsApp /> : <SettingsApp />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);
