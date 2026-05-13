import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          page: "#0a0a0a",
          sidebar: "#111114",
          card: "#0d0d0f",
        },
        foreground: {
          primary: "#fafafa",
          secondary: "#a1a1aa",
          muted: "#52525b",
        },
        accent: {
          DEFAULT: "#10b981",
          hover: "#059669",
          muted: "rgba(16,185,129,0.06)",
        },
        border: "rgba(255,255,255,0.06)",
        code: {
          bg: "#0d1117",
        }
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      maxWidth: {
        "7xl": "720px",
      },
      boxShadow: {
        'premium': '0 0 0 1px rgba(0,0,0,0.08), 0 4px 6px -1px rgba(0,0,0,0.12), 0 2px 4px -1px rgba(0,0,0,0.08)',
      }
    },
  },
  plugins: [],
};
export default config;

