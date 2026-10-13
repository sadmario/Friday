/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./frontend/index.html",
    "./frontend/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#07090e',
        surface: '#0d121f',
        'surface-card': 'rgba(15, 23, 42, 0.65)',
        'surface-border': 'rgba(56, 189, 248, 0.15)',
        cyan: {
          DEFAULT: '#00f0ff',
          dim: 'rgba(0, 240, 255, 0.15)',
          glow: 'rgba(0, 240, 255, 0.4)',
        },
        electric: '#38bdf8',
        neon: '#a855f7',
      },
      fontFamily: {
        sans: ['Segoe UI', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Cascadia Code', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'orb-glow': 'orbGlow 4s ease-in-out infinite alternate',
      },
      keyframes: {
        orbGlow: {
          '0%': { transform: 'scale(1)', filter: 'drop-shadow(0 0 20px rgba(0,240,255,0.4))' },
          '100%': { transform: 'scale(1.05)', filter: 'drop-shadow(0 0 45px rgba(56,189,248,0.8))' },
        }
      }
    },
  },
  plugins: [],
}
