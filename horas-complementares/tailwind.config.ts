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
          // Escala construida em torno da cor escolhida #660510.
          // Fica no 600 porque e o tom que botoes e menu usam.
          50:  '#FCF2F3',
          100: '#F7DFE2',
          200: '#EBB9BF',
          300: '#D17F89',
          400: '#A53A49',
          500: '#7D0714',
          600: '#660510',
          700: '#53040D',
          800: '#42030A',
          900: '#330208',
          950: '#1F0105',
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