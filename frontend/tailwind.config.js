/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['Consolas', 'Monaco', 'Andale Mono', 'Ubuntu Mono', 'monospace'],
        sans: ['Source Sans 3', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        jupyter: {
          orange: '#FF6B19',
          'orange-light': '#FF8C4C',
          bg: '#FFFFFF',
          toolbar: '#F7F7F7',
          border: '#CFCFCF',
          hover: '#E8E8E8',
          text: '#333333',
          muted: '#777777',
        },
      },
    },
  },
  plugins: [],
}
