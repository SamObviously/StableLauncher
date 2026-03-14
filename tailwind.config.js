/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--primary-accent-rgb) / <alpha-value>)',
        secondary: 'rgb(var(--primary-dark-rgb) / <alpha-value>)'
      }
    }
  },
  plugins: []
}
