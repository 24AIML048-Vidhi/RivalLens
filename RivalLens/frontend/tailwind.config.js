
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Base surfaces
        ink: "#0F1117",       
        surface: "#171A23",   
        "surface-hover": "#1F2330",
        border: "#262B3A",
        // Text
        "text-primary": "#EDEEF3",
        "text-muted": "#8B92A8",
        // Brand
        brand: {
          DEFAULT: "#6C5CE7",
          hover: "#7C6EF0",
          muted: "#3A3564",
        },
        // Semantic sentiment colors — ONLY used for sentiment data, never chrome
        positive: "#34D399",
        negative: "#F87171",
        neutral: "#FBBF24",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.6" },
          "70%": { transform: "scale(1.4)", opacity: "0" },
          "100%": { transform: "scale(1.4)", opacity: "0" },
        },
      },
      animation: {
        "pulse-ring": "pulseRing 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};