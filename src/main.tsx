import React from "react";
import ReactDOM from "react-dom/client";
import { SettingsApp } from "./settings/SettingsApp";
import { LiteSettingsApp } from "./settings/LiteSettingsApp";
import { useConfigStore } from "./store/configStore";
import "./index.css";

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
