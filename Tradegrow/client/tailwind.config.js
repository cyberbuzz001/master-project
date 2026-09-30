/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Every role below intentionally resolves to the two fonts actually
      // loaded (index.css:1 — Inter + JetBrains Mono). `headline`/`display`/
      // `label` previously pointed at 'Geist'/'Space Grotesk', neither of
      // which was ever loaded anywhere in the app — every element using
      // those utility classes (font-headline: OrderPreviewModal, GrowwHeader,
      // GrowwSubNav, IndexActionModal, UserProfileModal, and others) was
      // silently rendering in the browser's generic fallback sans-serif
      // instead of Inter. Role names are kept so no component needs to
      // change; only what they resolve to is fixed.
      fontFamily: {
        headline: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        body: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        label: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
