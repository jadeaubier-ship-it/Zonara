import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e3a8a",
          900: "#172554"
        },
        slate: {
          950: "#0f172a"
        }
      },
      boxShadow: {
        soft: "0 20px 40px rgba(15, 23, 42, 0.12)"
      },
      backgroundImage: {
        "hero-grid":
          "radial-gradient(circle at top left, rgba(37,99,235,0.20), transparent 35%), radial-gradient(circle at bottom right, rgba(15,23,42,0.16), transparent 30%)"
      }
    }
  },
  plugins: []
};

export default config;
