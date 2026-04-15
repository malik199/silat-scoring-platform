import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Dark background layers
        base: "#18181b",       // page background
        surface: "#232326",    // sidebar, cards
        elevated: "#2c2c30",   // inner card, hover states
        border: "#3a3a3f",

        // Green accent (from screenshot)
        accent: {
          DEFAULT: "#00d084",
          hover:   "#00b872",
          muted:   "#00d08420",
        },

        // Text
        primary:   "#ffffff",
        secondary: "#8a8a8e",
        muted:     "#55555a",

        // Status
        danger: "#ff4d4f",
        warn:   "#faad14",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
