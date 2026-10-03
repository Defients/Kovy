/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./overlay.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        kovy: {
          bg: "#0a0e1a",
          surface: "#111827",
          "surface-light": "#1e293b",
          border: "#1e3a5f",
          "border-light": "#2d4a6f",
          accent: "#6366f1",
          "accent-light": "#818cf8",
          cyan: "#22d3ee",
          violet: "#8b5cf6",
          glow: "#60a5fa",
          text: "#e2e8f0",
          "text-muted": "#94a3b8",
          "text-dim": "#64748b",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "SF Pro Display",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(99, 102, 241, 0.3)",
        "glow-lg": "0 0 40px rgba(99, 102, 241, 0.4)",
        "glow-cyan": "0 0 20px rgba(34, 211, 238, 0.3)",
        "elevated": "0 4px 24px rgba(0, 0, 0, 0.4)",
        "subtle": "0 2px 8px rgba(0, 0, 0, 0.2)",
      },
      zIndex: {
        "modal": 50,
        "toast": 60,
        "context-menu": 50,
        "command-palette": 100,
      },
      transitionDuration: {
        "fast": "150ms",
        "normal": "200ms",
        "slow": "300ms",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-breathe": "glowBreathe 3s ease-in-out infinite",
        "slide-in": "slideIn 200ms ease-out",
        "slide-up": "slideUp 200ms ease-out",
        "toast-in": "toastIn 250ms ease-out",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        glowBreathe: {
          "0%, 100%": { opacity: "0.6", transform: "scale(0.95)" },
          "50%": { opacity: "1", transform: "scale(1.0)" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateX(8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        toastIn: {
          from: { opacity: "0", transform: "translateY(20px) scale(0.95)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
