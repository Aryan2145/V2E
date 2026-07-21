import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#2563EB", hover: "#1D4ED8", light: "#EFF6FF" },
        success: "#16A34A",
        warning: "#D97706",
        danger: { DEFAULT: "#DC2626", hover: "#B91C1C" },
        info: "#0891B2",
        sidebar: { DEFAULT: "#0F172A", hover: "#1E293B", divider: "#1E293B" },
        border: "#E2E8F0",
        input: "#CBD5E1",
        heading: "#0F172A",
        body: "#1E293B",
        secondary: "#475569",
        muted: "#94A3B8",
        label: "#374151",
        helper: "#64748B",
      },
      borderRadius: {
        card: "12px",
        btn: "8px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
      },
      fontSize: {
        h1: ["28px", { fontWeight: "700" }],
        h2: ["22px", { fontWeight: "600" }],
        h3: ["18px", { fontWeight: "600" }],
        body: ["15px", { fontWeight: "400" }],
        small: ["13px", { fontWeight: "400" }],
        label: ["14px", { fontWeight: "500" }],
      },
      keyframes: {
        "fade-rise": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-rise": "fade-rise 0.5s cubic-bezier(0.2,0.7,0.2,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
