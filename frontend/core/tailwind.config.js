/** @type {import('tailwindcss').Config} */

module.exports = {
  content: ['**/*.{js,ts,tsx}', '../core/**/*.{js,ts,tsx}', './tailwind/**/*.css'],
  darkMode: ['selector', '[data-theme="dark"]'],
}
