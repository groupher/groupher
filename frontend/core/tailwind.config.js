/** @type {import('tailwindcss').Config} */

const { colors, safelist } = require('./tailwind.include')

module.exports = {
  content: [
    // but remove it will cause @tailwindcss/typography issue
    // './src/**/*.{js,ts,jsx,tsx}',
    '**/*.{js,ts,jsx,tsx}',
    '../core/**/*.{js,ts,jsx,tsx}',
    // './src/**/salon/**/*.ts',
  ],
  theme: {
    colors,
    extend: {
      keyframes: {
        'loading-grow': {
          '0%': { transform: 'scale(0, 0)', opacity: '0' },
          '100%': { transform: 'scale(1, 1)', opacity: '1' },
        },
        'loading-move': {
          '0%': { transform: 'translateX(0px)' },
          '100%': { transform: 'translateX(80px)' },
        },
      },
      animation: {
        'loading-grow': 'loading-grow 1s linear infinite',
        'loading-move': 'loading-move 1s linear infinite',
      },
    },
  },
  safelist,
}
