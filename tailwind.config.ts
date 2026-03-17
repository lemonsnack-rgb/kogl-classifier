import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Pretendard", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      colors: {
        primary: {
          50: "#F0F4FA",
          100: "#E8EDF5",
          200: "#C5D1E8",
          300: "#8FA4C9",
          400: "#6B87B5",
          500: "#4A6FA5",
          600: "#3A5A8A",
          700: "#2E4068",
          800: "#233356",
          900: "#1B2A4A",
        },
        accent: {
          50: "#E6F7F1",
          100: "#E6F7F1",
          200: "#B3E8D4",
          300: "#66D4AD",
          400: "#33C596",
          500: "#00B388",
          600: "#00845A",
          700: "#006B49",
          800: "#005238",
          900: "#003A28",
        },
        kogl: {
          1: "#00845A",
          2: "#2563EB",
          3: "#D97706",
          4: "#DC2626",
        },
        status: {
          processing: "#3B82F6",
          review: "#F59E0B",
          complete: "#10B981",
          failed: "#EF4444",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
