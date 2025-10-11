/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors')

const lightTokens = require('./lightTokens')
const darkTokens = require('./darkTokens')

module.exports = {
  transparent: {
    DEFAULT: 'transparent',
    dark: 'transparent',
  },
  container: {
    DEFAULT: lightTokens.bannerBg,
    dark: darkTokens.bannerBg,
  },
  card: {
    DEFAULT: lightTokens.bannerBg,
    dark: '#252525',
  },
  cardAlpha: {
    DEFAULT: '#ffffffd4', //lightTokens.bannerBg,
    dark: '#252526c2',
  },
  // TODO: remove to article
  text: {
    title: { DEFAULT: colors.gray['800'], dark: colors.gray['100'] },
    digest: { DEFAULT: colors.gray['500'], dark: colors.zinc['400'] },
    hint: {
      DEFAULT: colors.gray['400'],
      dark: colors.zinc['500'],
    },
    invert: {
      DEFAULT: colors.gray['100'],
      dark: colors.gray['800'],
    },
    link: { DEFAULT: lightTokens.link, dark: darkTokens.link },
  },
  link: { DEFAULT: lightTokens.link, dark: darkTokens.link },
  divider: { DEFAULT: lightTokens.border, dark: darkTokens.border },
  alphaBg: { DEFAULT: '#ffffff95', dark: '#31313194' },
  alphaBg2: { DEFAULT: '#fffffff2', dark: '#1c1c1cb8' },
  sandBox: { DEFAULT: '#F9F9F9', dark: '#31303059' },
  hoverBg: { DEFAULT: lightTokens.hoverBg, dark: darkTokens.hoverBg },
  menuHoverBg: { DEFAULT: 'white', dark: darkTokens.hoverBg },
  heightIcon: { DEFAULT: '#e48a3d', dark: '#e48a3d' },
  snackBar: { DEFAULT: colors.neutral['700'] },

  rainbow: {
    red: { DEFAULT: '#ca5f4d', dark: '#ca5f4d' },
    redSoft: { DEFAULT: '#FFEBEC', dark: '#7d3b363d' },

    orange: { DEFAULT: 'orange', dark: '#ffa500c7' },
    orangeSoft: { DEFAULT: '#FEF7E8', dark: '#3f332dba' },

    brown: { DEFAULT: '#8d691e', dark: '#a77c22' },
    brownSoft: { DEFAULT: '#fff3df', dark: '#3a342b' },

    yellow: { DEFAULT: '#c7b96d', dark: '#dac933cf' },
    yellowSoft: { DEFAULT: '#FEFBE8', dark: '#a9a06a30' },

    green: { DEFAULT: '#699411', dark: '#699411' },
    greenSoft: { DEFAULT: '#eefdd89c', dark: '#4248374a' },

    greenLight: { DEFAULT: '#79d08f', dark: '#37B784' },
    greenLightSoft: { DEFAULT: '#e3f3cc4a', dark: '#69735a4a' },

    cyan: { DEFAULT: '#24878C', dark: '#24878C' },
    cyanSoft: { DEFAULT: '#e1fcff', dark: '#2c3738' },

    // naming, fix later
    cyanLight: { DEFAULT: '#00B5CC', dark: '#00B5CC' },
    cyanLightSoft: { DEFAULT: '#e1fcff94', dark: '#39494b94' },
    // cyanLightPale: { DEFAULT: '#e1fcff94', dark: '#39494b94' },

    blue: { DEFAULT: '#5073C6', dark: '#3a7ec7' },
    blueSoft: { DEFAULT: '#E7EDF7', dark: '#27324c54' },

    purple: { DEFAULT: '#7d519e', dark: '#7d519e' },
    purpleSoft: { DEFAULT: '#f7d8fd38', dark: '#4a334f38' },

    pink: { DEFAULT: '#b36976', dark: '#b36976' },
    pinkSoft: { DEFAULT: '#ffd8ea59', dark: '#73526159' },
    // pinkPale: { DEFAULT: '#ffd8ea59', dark: '#73526159' },

    black: { DEFAULT: '#333333', dark: '#4e4e4e' },
    // TODO: is for dark theme only
    blackBtn: { DEFAULT: colors.gray['800'], dark: '#e6e6e6' },
    blackSoft: { DEFAULT: '#f4f4f4', dark: '#313131' },
  },
  // inspired by https://endless.design/
  gradientBg: {
    purple: {
      DEFAULT: 'linear-gradient(152deg,#faf5ff9c 0%,rgb(222 198 243) 100%)',
      dark: 'linear-gradient(-149deg,#373439d4 0%,rgb(86 70 99) 100%)',
    },
    blue: {
      DEFAULT: 'linear-gradient(310deg,#f6f3ff54 13%,rgb(209 237 255 / 83%) 100%)',
      dark: 'linear-gradient(310deg,#303435 13%,rgb(49 84 121 / 83%) 100%)',
    },
    green: {
      DEFAULT: 'linear-gradient(28deg,#fffbf6 0%,rgb(216 240 221 / 80%) 100%)',
      dark: 'linear-gradient(133deg,#343434 0%,rgb(58 83 63 / 80%) 100%)',
    },
    orange: {
      DEFAULT: 'linear-gradient(244deg,#fffcf75e 0%,rgb(255 234 217 / 72%) 100%)',
      dark: 'linear-gradient(244deg,#3d3d3d 0%,rgb(106 82 62 / 72%) 100%)',
    },
    pink: {
      DEFAULT: 'linear-gradient(224deg,#fde4ff24 0%,rgb(255 223 234 / 79%) 100%)',
      dark: 'linear-gradient(140deg,#fff5fb99 0%,rgb(255 231 230 / 84%) 100%)',
    },
    black: {
      DEFAULT: 'linear-gradient(25deg,#fafafaba 20%,#bdccce63 100%)',
      dark: 'linear-gradient(220deg,#fafafaba 0%,#ededede3 100%)',
    },
    cyan: {
      DEFAULT: 'linear-gradient(213deg,#fffff3ba 13%,#aff5ffc2 100%)',
      dark: 'linear-gradient(310deg,#eafffe7a 13%,rgb(183 242 246 / 46%) 100%)',
    },
    yellow: {
      DEFAULT: 'linear-gradient(150deg,#ffe5e529 20%,rgb(255 251 216 / 58%) 100%)',
      dark: 'linear-gradient(53deg,#fffff37a 13%,rgb(255 244 140 / 25%) 100%)',
    },
  },
  dot: {
    DEFAULT: colors.slate['500'],
    dark: colors.slate['400'],
  },
  drawer: {
    mask: { DEFAULT: 'rgba(31, 34, 37, 0.15)', dark: 'rgb(21 21 21 / 72%)' },
  },
  button: {
    toggle: { DEFAULT: 'white', dark: colors.slate['50'] },
    redBg: { DEFAULT: colors.rose['100'], dark: '#472823' },
    fg: { DEFAULT: 'white', dark: '#f1f1f1' },
  },
  notice: {
    bg: { DEFAULT: '#FDF6E8', dark: '#FDF6E8' },
    icon: { DEFAULT: '#a57a32', dark: '#a57a32' },
  },
  popover: {
    bg: { DEFAULT: '#fafafa', dark: '#2e2e2ef0' }, // '#fffffff2',
  },
  modal: {
    bg: { DEFAULT: lightTokens.contentBoxBg, dark: darkTokens.contentBoxBg },
    mask: { DEFAULT: 'rgba(31, 34, 37, 0.1)', dark: 'rgba(31, 34, 37, 0.55)' },
    subPanel: { DEFAULT: '#F5F5F5', dark: '#1b1b1b' },
  },
  form: {
    inputBg: { DEFAULT: '#ffffff95', dark: '#1f1f1f7a' },
  },
}
