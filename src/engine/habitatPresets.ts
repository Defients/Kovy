// ============================================================
// Habitat Presets — pre-configured habitat layouts that can be
// applied with one click. Each preset defines objects for a
// specific environment style.
// ============================================================

import type { HabitatObjectsConfig } from "@/store/types";

export interface HabitatPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  habitatObjects: HabitatObjectsConfig;
}

function obj(id: string, type: string, x: number, y: number) {
  return { id, type, position: { x, y }, placedAt: Date.now() };
}

export const HABITAT_PRESETS: HabitatPreset[] = [
  {
    id: "cozy-room",
    name: "Cozy Room",
    description: "A warm, enclosed space with a bed and plants",
    icon: "🏠",
    habitatObjects: {
      enabled: true,
      maxObjects: 12,
      objects: [
        obj("bed-1", "bed", 0.15, 0.8),
        obj("plant-1", "plant", 0.85, 0.75),
        obj("plant-2", "plant", 0.1, 0.5),
        obj("lamp-1", "lamp", 0.5, 0.2),
      ],
    },
  },
  {
    id: "garden",
    name: "Garden",
    description: "Open outdoor space with trees and flowers",
    icon: "🌸",
    habitatObjects: {
      enabled: true,
      maxObjects: 18,
      objects: [
        obj("tree-1", "tree", 0.2, 0.7),
        obj("tree-2", "tree", 0.75, 0.65),
        obj("flower-1", "flower", 0.4, 0.85),
        obj("flower-2", "flower", 0.55, 0.88),
        obj("flower-3", "flower", 0.35, 0.9),
        obj("pond-1", "pond", 0.6, 0.75),
      ],
    },
  },
  {
    id: "space-station",
    name: "Space Station",
    description: "Futuristic zero-gravity habitat",
    icon: "🚀",
    habitatObjects: {
      enabled: true,
      maxObjects: 10,
      objects: [
        obj("console-1", "console", 0.3, 0.6),
        obj("console-2", "console", 0.7, 0.6),
        obj("window-1", "window", 0.5, 0.15),
        obj("reactor-1", "reactor", 0.1, 0.8),
      ],
    },
  },
  {
    id: "forest-cabin",
    name: "Forest Cabin",
    description: "Rustic cabin surrounded by nature",
    icon: "🌲",
    habitatObjects: {
      enabled: true,
      maxObjects: 15,
      objects: [
        obj("cabin-1", "cabin", 0.5, 0.65),
        obj("tree-1", "tree", 0.1, 0.6),
        obj("tree-2", "tree", 0.15, 0.8),
        obj("tree-3", "tree", 0.85, 0.65),
        obj("tree-4", "tree", 0.9, 0.85),
        obj("fire-1", "campfire", 0.5, 0.85),
      ],
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean, distraction-free environment",
    icon: "✨",
    habitatObjects: {
      enabled: true,
      maxObjects: 5,
      objects: [
        obj("perch-1", "perch", 0.5, 0.5),
      ],
    },
  },
  {
    id: "playground",
    name: "Playground",
    description: "Fun interactive space with toys",
    icon: "🎮",
    habitatObjects: {
      enabled: true,
      maxObjects: 20,
      objects: [
        obj("ball-1", "ball", 0.3, 0.7),
        obj("ball-2", "ball", 0.7, 0.75),
        obj("slide-1", "slide", 0.5, 0.6),
        obj("swing-1", "swing", 0.15, 0.5),
        obj("blocks-1", "blocks", 0.8, 0.8),
      ],
    },
  },
];

export function getPresetById(id: string): HabitatPreset | null {
  return HABITAT_PRESETS.find(p => p.id === id) ?? null;
}
