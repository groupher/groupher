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
      boxShadow: {
        sm: 'rgba(100, 100, 111, 0.1) 1px 2px 29px 0px',
        'sm-dark': '#19191b66 1px 2px 29px 0px',
        md: 'rgba(0, 0, 0, 0.03) 0px 6px 24px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px',
        'md-dark': 'rgba(0, 0, 0, 0.03) 0px 6px 24px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px',
        lg: 'rgba(0, 0, 0, 0.05) 0px 6px 24px 0px, rgba(0, 0, 0, 0.08) 0px 0px 0px 1px',
        'lg-dark': '-9px 7px 20px 9px rgb(24 24 24 / 15%)',
        xl: '-3px 2px 20px 0px rgb(58 58 58 / 15%)',
        'xl-dark': '-9px 7px 20px 9px rgb(24 24 24 / 44%)',
        drawer: '-8px 8px 20px 11px rgb(143 143 143 / 2%)',
        'drawer-dark': '-13px 1px 20px 11px rgb(0 0 0 / 9%)',
        modal: '-2px 4px 20px 0px rgb(158 157 157 / 23%)',
        'modal-dark': '-4px 5px 20px 5px rgb(21 21 21 / 47%)',
      },
      // borderColor: (theme) => ({
      // 'custom-light/35': `${theme('colors.rainbow.purple.light')}59`, // 35% 透明度
      // 'rainbow-purple-dark/75': 'rgba(var(--rainbow-custom-dark), 0.75)',
      // }),
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
