/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors')

const lightTokens = require('./lightTokens')
const darkTokens = require('./darkTokens')

module.exports = {
  transparent: {
    DEFAULT: 'transparent',
    dark: 'transparent',
  },
  primary: {
    DEFAULT: lightTokens.primaryColor,
    dark: darkTokens.primaryColor,
  },
  htmlBg: {
    DEFAULT: lightTokens.bannerBg,
    dark: darkTokens.bannerBg,
  },
  card: {
    DEFAULT: lightTokens.bannerBg,
    dark: '#252525',
  },
  cardAlpha: {
    DEFAULT: lightTokens.bannerBg,
    dark: '#252526c2',
  },
  loading: {
    basic: {
      DEFAULT: colors.slate['400'],
      dark: colors.slate['500'],
    },
    animate: {
      DEFAULT: lightTokens.contentBg,
      dark: darkTokens.contentBg,
    },
  },
  error: {
    title: {
      DEFAULT: lightTokens.primaryColor,
      dark: darkTokens.primaryColor,
    },
    desc: {
      DEFAULT: lightTokens.primaryColor,
      dark: darkTokens.primaryColor,
    },
    bg: {
      DEFAULT: lightTokens.contentBoxBg,
      dark: darkTokens.contentBoxBg,
    },
  },
  font: { DEFAULT: lightTokens.fontColor, dark: darkTokens.fontColor },
  link: { DEFAULT: lightTokens.link, dark: darkTokens.link },
  blackActive: { DEFAULT: '#3171DB', dark: '#3171DB' },
  divider: { DEFAULT: lightTokens.border, dark: darkTokens.border },
  alphaBg: { DEFAULT: '#ffffff95', dark: darkTokens.hoverBg },
  alphaBg2: { DEFAULT: '#fffffff2', dark: '#1c1c1cb8' },
  sandBox: { DEFAULT: '#f9f9f9', dark: '#31303059' },
  hoverBg: { DEFAULT: lightTokens.hoverBg, dark: darkTokens.hoverBg },
  hoverActive: { DEFAULT: 'white', dark: '#3f3f3f' },
  menuHoverBg: { DEFAULT: 'white', dark: darkTokens.hoverBg },
  lineDivider: { DEFAULT: '#acacacc9', dark: '#5a5a5ac9' },
  hoverBorder: { DEFAULT: lightTokens.hoverBg, dark: '#393939' },
  linkHover: { DEFAULT: lightTokens.link, dark: darkTokens.link },
  heightIcon: { DEFAULT: '#e48a3d', dark: '#e48a3d' },
  heightGradient: {
    DEFAULT: 'linear-gradient(90deg, rgb(243, 170, 0) 0%, rgb(228, 62, 41) 100%)',
    dark: 'linear-gradient(90deg, rgb(243, 170, 0) 0%, rgb(228, 62, 41) 100%)',
  },
  bodyBg: { DEFAULT: lightTokens.contentBg, dark: darkTokens.contentBg },
  textBadge: { DEFAULT: '#e2e2e287', dark: '#e2e2e287' }, // with alpha
  lightText: { DEFAULT: '#999999', dark: '#999999' },
  hint: { DEFAULT: lightTokens.hint, dark: darkTokens.hint },
  articleCardShadow: {
    DEFAULT: '0 2px 40px 0 rgb(224 226 228 / 27%)',
    dark: '0 2px 40px 0 rgb(62 62 62 / 27%))',
  },
  articleCardHover: { DEFAULT: '#c1c1c1', dark: '#575757' },
  dashboardBlockOpacity: { DEFAULT: 0.65, dark: 0.7 },
  snackBar: { DEFAULT: colors.neutral['700'] },

  rainbow: {
    red: { DEFAULT: '#ca5f4d', dark: '#ca5f4d' },
    redSoft: { DEFAULT: '#FFEBEC', dark: '#7d3b363d' },
    // redPale: {
    //   DEFAULT: 'linear-gradient(90deg, #fec0bb33 0%, #f8e4e226 100%)',
    //   dark: 'linear-gradient(90deg, #7a37323d 0%, #46211e2b 100%)',
    // },

    orange: { DEFAULT: 'orange', dark: '#ffa500c7' },
    orangeSoft: { DEFAULT: '#FEF7E8', dark: '#3f332dba' },
    // orangePale: {
    //   DEFAULT: 'linear-gradient(90deg, #fcb32d26 0%, #f5dfb726 100%)',
    //   dark: 'linear-gradient(90deg, #44352ead 0%, #382c27a1 100%)',
    // },

    brown: { DEFAULT: '#8d691e', dark: '#8d691e' },
    brownSoft: { DEFAULT: '#fff3df', dark: '#3a342b' },
    // brownPale: {
    //   DEFAULT: 'linear-gradient(90deg, #cf806921 0%, #dbd0d01c 100%)',
    //   dark: 'linear-gradient(90deg, #45320569 0%, #3929024a 100%)',
    // },

    yellow: { DEFAULT: '#c7b96d', dark: '#dac933cf' },
    yellowSoft: { DEFAULT: '#FEFBE8', dark: '#a9a06a30' },
    // yellowPale: {
    //   DEFAULT: 'linear-gradient(90deg, #fffde5 0%, rgb(255 252 241 / 37%) 100%)',
    //   dark: 'linear-gradient(90deg, #635e184d 0%, #433e2330 100%)',
    // },

    green: { DEFAULT: '#699411', dark: '#699411' },
    greenSoft: { DEFAULT: '#eefdd89c', dark: '#4248374a' },
    // greenPale: {
    //   DEFAULT: 'linear-gradient(90deg, #e3f3cc4a 0%, #f2ffe05c 100%)',
    //   dark: 'linear-gradient(90deg, #636e534a 0%, #474e3c36 100%)',
    // },

    greenLight: { DEFAULT: '#79d08f', dark: '#37B784' },
    greenLightSoft: { DEFAULT: '#e3f3cc4a', dark: '#69735a4a' },
    // greenLightPale: {
    //   DEFAULT: 'linear-gradient(90deg, #e3f3cc4a 0%, #f2ffe05c 100%)',
    //   dark: 'linear-gradient(90deg, #636e534a 0%, #474e3c36 100%)',
    // },

    cyan: { DEFAULT: '#24878C', dark: '#24878C' },
    cyanSoft: { DEFAULT: '#e1fcff', dark: '#2c3738' },
    // cyanPale: {
    //   DEFAULT: 'linear-gradient(90deg, #e1fcff94 0%, #e1fcff5e 100%)',
    //   dark: 'linear-gradient(90deg, #2c3738 0%, #2c37386e 100%)',
    // },

    // naming, fix later
    cyanLight: { DEFAULT: '#00B5CC', dark: '#00B5CC' },
    cyanLightSoft: { DEFAULT: '#e1fcff94', dark: '#39494b94' },
    // cyanLightPale: { DEFAULT: '#e1fcff94', dark: '#39494b94' },

    blue: { DEFAULT: '#5073C6', dark: '#3a7ec7' },
    blueSoft: { DEFAULT: '#E7EDF7', dark: '#27324c54' },
    // bluePale: {
    //   DEFAULT: 'linear-gradient(90deg, #f3f7ff 0%, #f5f8ffb5 100%);',
    //   dark: 'linear-gradient(90deg, #505a7254 0%, #3a415038 100%)',
    // },

    purple: { DEFAULT: '#7d519e', dark: '#7d519e' },
    purpleSoft: { DEFAULT: '#f7d8fd38', dark: '#4a334f38' },
    // purplePale: {
    //   DEFAULT: 'linear-gradient(90deg, #f7d8fd38 0%, #f5e5f838 100%)',
    //   dark: 'linear-gradient(90deg, #86539147  0%, #58445d38 100%)',
    // },

    grey: { DEFAULT: '#106d8a', dark: '#106d8a' },

    pink: { DEFAULT: '#b36976', dark: '#b36976' },
    pinkSoft: { DEFAULT: '#ffd8ea59', dark: '#73526159' },
    // pinkPale: { DEFAULT: '#ffd8ea59', dark: '#73526159' },

    black: { DEFAULT: '#333333', dark: '#4e4e4e' },
    // TODO: is for dark theme only
    blackBtn: { DEFAULT: colors.gray['800'], dark: '#4e4e4e' },
    blackSoft: { DEFAULT: '#f4f4f4', dark: '#313131' },
    // blackPale: { DEFAULT: '#f4f4f4', dark: '#313131' },

    // custom primary
    // custom: { DEFAULT: '--var(rainbow-custom)', dark: '--var(rainbow-custom-dark)' },
    // custom: { DEFAULT: 'var(--rainbow-custom)', dark: 'var(--rainbow-custom-dark)' },
  },
  grey: {
    rare: { DEFAULT: '#fafafa', dark: '#272727' },
    middle: { DEFAULT: '#F1F3F4', dark: '#333333' },
    hard: { DEFAULT: '#F1F3F4', dark: '#414141' },
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
  text: {
    // title: { DEFAULT: lightTokens.threadTitle, dark: darkTokens.threadTitle },
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
  dot: {
    DEFAULT: colors.slate['500'],
    dark: colors.slate['400'],
  },
  article: {
    title: {
      DEFAULT: lightTokens.threadTitle,
      dark: darkTokens.threadTitle,
    },
    digest: { DEFAULT: lightTokens.descText, dark: darkTokens.descText },
    info: { DEFAULT: lightTokens.actionText, dark: darkTokens.actionText },
    link: { DEFAULT: lightTokens.link, dark: darkTokens.link },
  },
  content: {
    bg: { DEFAULT: lightTokens.contentBoxBg, dark: darkTokens.contentBoxBg },
  },
  footer: {
    text: { DEFAULT: lightTokens.descText, dark: darkTokens.descText },
    hover: { DEFAULT: '#949CB5', dark: '#949CB5' },
    title: { DEFAULT: '#77706B', dark: '#77706B' },
    bottomBg: { DEFAULT: '#252325', dark: '#252325' },
  },
  drawer: {
    mask: { DEFAULT: 'rgba(31, 34, 37, 0.15)', dark: 'rgb(31 34 37 / 41%)' },
    bg: { DEFAULT: lightTokens.contentBg, dark: '#252525' },
    shadow: {
      DEFAULT: '-8px 8px 20px 11px rgb(143 143 143 / 2%)',
      dark: '-13px 1px 20px 11px rgb(0 0 0 / 9%)',
    },
    shadowLite: {
      DEFAULT: '-8px 8px 20px 11px rgb(143 143 143 / 2%)',
      dark: '-5px 5px 20px 11px rgb(13 13 13 / 14%)',
    },
    closerShadow: {
      DEFAULT: '-7px 4px 20px 0px rgb(143 143 143 / 2%)',
      dark: '-3px 12px 20px 0px rgb(32 29 29 / 83%)',
    },
    border: { DEFAULT: 'transparent', dark: '#363636' },
  },
  comment: {
    bg: { DEFAULT: lightTokens.contentBg, dark: darkTokens.contentBg },
    icon: { DEFAULT: 'grey', dark: 'grey' },
    didIcon: { DEFAULT: 'orange', dark: 'orange' },
    title: { DEFAULT: 'grey', dark: 'grey' },
    username: { DEFAULT: '#7FA7AC', dark: '#7FA7AC' },
    number: { DEFAULT: '#efbc60', dark: '#efbc60' },
    floor: { DEFAULT: '#8590a6', dark: '#8590a6' },
    reply: { DEFAULT: '#93b3b5', dark: '#93b3b5' },
    replyBg: { DEFAULT: '#f3f3f3', dark: '#f3f3f3' },
    placeholder: { DEFAULT: '#8c94a3', dark: '#8c94a3' },
    filter: { DEFAULT: 'grey', dark: 'grey' },
    filterActive: { DEFAULT: lightTokens.primaryColor, dark: darkTokens.primaryColor },
    action: { DEFAULT: lightTokens.actionText, dark: darkTokens.actionText },
    mentionText: { DEFAULT: '#91a4b5', dark: '#91a4b5' },
    mentionTextBg: { DEFAULT: '#fcffdb', dark: '#fcffdb' },
    mentionBg: { DEFAULT: '#F9FCFC', dark: '#F9FCFC' },
    mentionBorder: { DEFAULT: lightTokens.primaryColor, dark: darkTokens.primaryColor },
    indentLine: { DEFAULT: '#E7E9ED', dark: '#E7E9ED' },
    indentActive: { DEFAULT: '#B5BCCB', dark: '#B5BCCB' },
  },
  editor: {
    title: { DEFAULT: '#7ea9ad', dark: '#7ea9ad' },
    content: { DEFAULT: '#a6bebf', dark: '#a6bebf' },
    placeholder: { DEFAULT: '#B3CFD0', dark: '#B3CFD0' },
    contentBg: { DEFAULT: '#F9FCFC', dark: '#F9FCFC' },
    border: { DEFAULT: '#D6D6D6', dark: '#414141' },
    borderActive: { DEFAULT: lightTokens.descText, dark: darkTokens.descText },
    borderNormal: { DEFAULT: '#e2eaea', dark: '#e2eaea' },
    footer: { DEFAULT: '#a6bebf', dark: '#a6bebf' },
  },
  code: {
    bg: { DEFAULT: lightTokens.contentBoxBg },
  },
  button: {
    primary: { DEFAULT: lightTokens.primaryColor, dark: darkTokens.primaryColor },
    toggle: { DEFAULT: 'white', dark: colors.slate['50'] },
    redBg: { DEFAULT: colors.rose['100'], dark: '#472823' },
    fg: { DEFAULT: 'white', dark: '#f1f1f1' },
    hoverBg: { DEFAULT: lightTokens.primaryColor, dark: darkTokens.primaryColor },
    upvoteBorder: { DEFAULT: '#c5c5c5b0', dark: '#5f5f5fb5' },
  },
  navigator: {
    activeBottom: { DEFAULT: lightTokens.primaryColor, dark: darkTokens.primaryColor },
    borderRight: { DEFAULT: lightTokens.bannerBg, dark: darkTokens.primaryColor },
    hoverBg: { DEFAULT: '#eee', dark: '#eee' },
  },
  popover: {
    bg: { DEFAULT: '#fafafa', dark: '#2e2e2ef0' }, // '#fffffff2',
    borderColor: { DEFAULT: '#e9e9ea', dark: darkTokens.border },
    boxShadow: {
      DEFAULT: '-3px 2px 20px 0px rgb(58 58 58 / 15%)',
      dark: '-9px 7px 20px 9px rgb(24 24 24 / 44%)',
    },
    activeBorder: { DEFAULT: '#70707094', dark: '#70707094' },
  },
  tags: {
    text: { DEFAULT: lightTokens.descText, dark: darkTokens.descText },
  },
  tagger: {
    text: { DEFAULT: '#d2a05f', dark: '#d2a05f' },
    bg: { DEFAULT: '#fff2b3', dark: '#fff2b3' },
    border: { DEFAULT: '#fff2b3', dark: '#fff2b3' },
    closeBtn: { DEFAULT: '#d2a05f', dark: '#d2a05f' },
  },
  tabs: {
    headerActive: { DEFAULT: '#EB6224', dark: '#EB6224' },
    header: { DEFAULT: '#b5b5b5', dark: '#b5b5b5' },
    contentBg: { DEFAULT: '#FFFFFF', dark: '#FFFFFF' },
    headerBg: { DEFAULT: '#F7F9F9', dark: '#F7F9F9' },
    headerActiveTop: { DEFAULT: lightTokens.primaryColor, dark: darkTokens.primaryColor },
    border: { DEFAULT: '#E8E8E8', dark: '#E8E8E8' },
    bottomLine: { DEFAULT: '#E1E4E8', dark: '#E1E4E8' },
  },
  modal: {
    bg: { DEFAULT: lightTokens.contentBoxBg, dark: darkTokens.contentBoxBg },
    mask: { DEFAULT: 'rgba(31, 34, 37, 0.1)', dark: 'rgba(31, 34, 37, 0.55)' },
    border: { DEFAULT: lightTokens.primaryColor, dark: darkTokens.primaryColor },
    shadow: {
      DEFAULT: '-2px 4px 20px 0px rgb(158 157 157 / 23%)',
      dark: '-4px 5px 20px 5px rgb(21 21 21 / 47%)',
    },
    innerSelectBg: { DEFAULT: '#e4eeed45', dark: '#e4eeed45' },
    subPanel: { DEFAULT: '#F5F5F5', dark: '#1b1b1b' },
  },
  form: {
    inputBg: { DEFAULT: '#ffffff95', dark: '#1f1f1f7a' },
    text: { DEFAULT: '#88a4ad', dark: '#88a4ad' },
    label: { DEFAULT: '#88a4ad', dark: '#88a4ad' },
    border: { DEFAULT: '#B8C6C0', dark: '#B8C6C0' },
    shadow: { DEFAULT: 'rgba(184, 198, 192, 0.3)', dark: 'rgba(184, 198, 192, 0.3)' },
  },
  a: {
    hover: { DEFAULT: lightTokens.primaryColor, dark: darkTokens.primaryColor },
    active: { DEFAULT: lightTokens.primaryColor, dark: darkTokens.primaryColor },
  },
  toast: {
    bg: { DEFAULT: lightTokens.contentBoxBg, dark: '#2c2c2c' },
    border: { DEFAULT: lightTokens.border, dark: darkTokens.border },
    title: { DEFAULT: lightTokens.threadTitle, dark: '#afafaf' },
  },
  table: {
    headerBg: { DEFAULT: '#F8F8F8', dark: '#F8F8F8' },
    headTitle: { DEFAULT: '#949494', dark: '#949494' },
    text: { DEFAULT: '#949497', dark: '#949497' },
    border: { DEFAULT: '#F0F0F0', dark: '#F0F0F0' },
    hoverBg: { DEFAULT: '#FAFBFC', dark: '#FAFBFC' },
  },
  avatar: {
    quote: { DEFAULT: '#217470', dadrk: '#217470' },
    shadow: {
      DEFAULT: '0px 0px 4px 0px rgb(0 0 0 / 50%) inset',
      dark: '0px 0px 4px 0px rgb(0 0 0 / 50%) inset',
    },
  },
  dashboard: {
    menuCat: { DEFAULT: lightTokens.threadTitle, dark: '#c1c1c1' },
    menuTitle: { DEFAULT: lightTokens.descText, dark: '#b7b7b7' },
    blockActiveBg: { DEFAULT: '#ffffff95', dark: '#2b2a2a7a' },
  },
  toggle: {
    shadow: {
      DEFAULT: '0 0 10px 0 rgb(185 185 185 / 25%) inset',
      dark: '0 0 20px 0px rgb(0 0 0 / 46%) inset',
    },
    ball: { DEFAULT: 'white', dark: '#ffffffb5' },
  },
  hiddenPanel: {
    DEFAULT: 'linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 1) 40%)',
    dark: 'linear-gradient(180deg, rgb(0 0 0 / 0%) 0%, rgb(35 35 35) 40%)',
  },
}
