/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080A0C",
        panel: "#1A1A1A",
        accent: "#FFD358",
        muted: "#9A9A9A"
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
