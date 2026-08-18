/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // "brand" is used everywhere in the app. Kept deep + desaturated so
        // it works as a hairline/text accent on black, not a filled block.
        brand: {
          50: "#e8f4ef",
          100: "#c7e6da",
          200: "#93cdb2",
          300: "#5fb28c",
          400: "#3a9670",
          500: "#227a5a",
          600: "#175f47",
          700: "#124a38",
          800: "#0e3a2c",
          900: "#0a2b21",
        },
        dark: {
          bg: "#020302",
          surface: "#080909",
          card: "#0d0e0e",
          border: "#191b1a",
        },
      },
      backgroundImage: {
        // barely-there — a hint of green light, not a tint over the page
        "grid-glow": "radial-gradient(circle at top left, rgba(34,122,90,0.07), transparent 45%)",
      },
    },
  },
  plugins: [],
};