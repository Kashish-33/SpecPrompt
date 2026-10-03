/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        canvas: "#09090b",
        panel: "#18181b",
      },
      boxShadow: {
        glow: "0 0 0 1px rgb(63 63 70 / 0.6), 0 20px 50px -20px rgb(0 0 0 / 0.6)",
      },
    },
  },
  plugins: [],
};
