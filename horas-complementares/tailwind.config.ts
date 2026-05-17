import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        navy: {
          800: '#1e1b4b',
          900: '#0f0d2b',
        },
        vinho: {
          50:  '#fef2f3',
          100: '#fde0e2',
          200: '#fbb8bd',
          300: '#f78690',
          400: '#f14455',
          500: '#e01d30',
          600: '#b81526',
          700: '#790E18',
          800: '#5e0b13',
          900: '#43080e',
          950: '#26040a',
        },
      },
      animation: {
        'bar-grow': 'barGrow 0.7s ease-out forwards',
      },
      keyframes: {
        barGrow: {
          from: { width: '0%' },
          to: { width: 'var(--target-width)' },
        },
      },
    },
  },
  plugins: [],
}

export default config