export default {
  content: [
    "./src/pages/**/*.{astro,html,ts,js,jsx,tsx}",
    "./src/components/**/*.{astro,html,ts,js,jsx,tsx}",
    "./src/scripts/**/*.{ts,js}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        pixel: ["var(--font-pixel)", "monospace", "monospace", "monospace"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace", "monospace"],
      },
      colors: {
        canvas: "var(--color-background)",
        deep: "var(--color-background-deep)",
        surface: "var(--color-surface)",
        raised: "var(--color-surface-raised)",
        sunken: "var(--color-surface-sunken)",
        ink: "var(--color-foreground)",
        paper: "var(--color-paper)",
        paperInk: "var(--color-paper-ink)",
        muted: "var(--color-muted)",
        dim: "var(--color-dim)",
        line: "var(--color-border)",
        lineStrong: "var(--color-border-strong)",
        accentRed: "var(--color-accent-red)",
        accentYellow: "var(--color-accent-yellow)",
        accentBlue: "var(--color-accent-blue)",
        accentPurple: "var(--color-accent-purple)",
        accentRedInk: "var(--color-accent-red-ink)",
        accentYellowInk: "var(--color-accent-yellow-ink)",
        accentBlueInk: "var(--color-accent-blue-ink)",
        accentPurpleInk: "var(--color-accent-purple-ink)",
        onRed: "var(--color-on-red)",
        onYellow: "var(--color-on-yellow)",
        onBlue: "var(--color-on-blue)",
        onPurple: "var(--color-on-purple)",
        terminal: "var(--color-terminal-bg)",
        focus: "var(--color-focus)",
      },
      boxShadow: {
        hard: { DEFAULT: "6px 6px 0 var(--shadow-color, #0a0a0d)" },
        hot: { DEFAULT: "6px 6px 0 var(--color-accent-red, #ff303f)" },
        cobalt: { DEFAULT: "7px 7px 0 var(--color-accent-blue, #2864ff)" },
        violet: { DEFAULT: "7px 7px 0 var(--color-accent-purple, #873bff)" },
        paper: { DEFAULT: "7px 7px 0 var(--color-paper-shadow, #0a0a0d)" },
        yellow: { DEFAULT: "6px 6px 0 var(--color-accent-yellow, #ffd83d)" },
      },
      clipPath: {
        pixel:
          "polygon(0 6px, 6px 6px, 6px 0, calc(100% - 6px) 0, calc(100% - 6px) 6px, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 6px calc(100% - 6px), 0 calc(100% - 6px))",
      },
      keyframes: {
        "pixel-in": {
          "0%": { opacity: "0", transform: "translate(0, 14px)" },
          "55%": { opacity: "1", transform: "translate(0, -3px)" },
          "100%": { opacity: "1", transform: "translate(0, 0)" },
        },
      },
      animation: {
        "pixel-in": "pixel-in 420ms steps(4, end) both",
      },
    },
  },
  plugins: [],
};
