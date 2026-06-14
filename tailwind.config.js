/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080A0C",
        app: "rgb(var(--color-ink) / <alpha-value>)",
        panel: "rgb(var(--color-panel) / <alpha-value>)",
        sheet: "rgb(var(--color-sheet) / <alpha-value>)",
        nav: "rgb(var(--color-nav) / <alpha-value>)",
        accent: "#FFD358",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        white: "rgb(var(--color-primary) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)"
      },
      fontFamily: {
        sans: ['"Inter Tight"', "sans-serif"]
      },
      boxShadow: {
        glow: "0 12px 34px rgba(255, 211, 88, 0.18)"
      }
    }
  },
  plugins: []
};
