import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#1a1d27',
          raised: '#21263a',
          overlay: '#282d42'
        },
        border: {
          DEFAULT: '#2e3452'
        },
        accent: {
          DEFAULT: '#5c6bc0',
          hover: '#7986cb',
          muted: '#3d4875'
        },
        success: '#4caf82',
        error: '#ef5350',
        warning: '#ffb74d',
        info: '#42a5f5'
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace']
      }
    }
  },
  plugins: []
}

export default config
