/*
 * light mode
 */
import { lighten, darken } from '~/utils/color'

const primaryColor = '#333333' // '#000000'
const bannerBg = '#fff'
const contentBg = '#fff'
const contentBoxBg = '#fff'
const fontColor = primaryColor
const border = '#EAE9E9'
const link = '#5073C6'

const actionText = '#647392'
const descText = '#666'
const threadTitle = '#333333'
const hoverBg = '#efefef78' // '#efefef9c' // with alpha
const hint = '#9d9999'

export default {
  transparent: '',
  primary: primaryColor,
  htmlBg: bannerBg,
  cardBg: '',
  loading: {
    basic: '#E0E0E0',
    animate: contentBg,
  },
  error: {
    title: primaryColor,
    desc: darken(primaryColor, 10),
    bg: lighten(contentBoxBg, 2),
  },
  font: fontColor,
  link,
  blackActive: '#3171DB',
  divider: border,
  alphaBg: '#ffffff95',
  alphaBg2: '#fffffff2',
  sandBox: '',
  hoverBg,
  hoverActive: 'white',
  menuHoverBg: 'white',
  lineDivider: '#acacacc9',
  hoverBorder: hoverBg,
  linkHover: lighten(link, 5),
  heightIcon: '#e48a3d',
  heightGradient: 'linear-gradient(90deg, rgb(243, 170, 0) 0%, rgb(228, 62, 41) 100%)',
  bodyBg: contentBg,
  textBadge: '#e2e2e287', // with alpha
  lightText: '#999999',
  hint,
  articleCardShadow: '0 2px 40px 0 rgb(224 226 228 / 27%)',
  articleCardHover: '#c1c1c1',
  dashboardBlockOpacity: 0.65,
  snackBar: '',

  rainbow: {
    red: '#ca5f4d',
    redSoft: '#ffbfba3d',
    redPale: 'linear-gradient(90deg, #fec0bb33 0%, #f8e4e226 100%)',

    orange: 'orange',
    orangeSoft: '#FEF7E8',
    orangePale: 'linear-gradient(90deg, #fcb32d26 0%, #f5dfb726 100%)',

    brown: '#8d691e',
    brownSoft: '#fff3df',
    brownPale: 'linear-gradient(90deg, #cf806921 0%, #dbd0d01c 100%)',

    yellow: '#c7b96d',
    yellowSoft: '#FEFBE8',
    yellowPale: 'linear-gradient(90deg, #fffde5 0%, rgb(255 252 241 / 37%) 100%)',

    green: '#699411',
    greenSoft: '#eefdd89c',
    greenPale: 'linear-gradient(90deg, #e3f3cc4a 0%, #f2ffe05c 100%)',

    greenLight: '#79d08f',
    greenLightSoft: '#e3f3cc4a',
    greenLightPale: 'linear-gradient(90deg, #e3f3cc4a 0%, #f2ffe05c 100%)',

    cyan: '#24878C',
    cyanSoft: '#e1fcff',
    cyanPale: 'linear-gradient(90deg, #e1fcff94 0%, #e1fcff5e 100%)',

    // naming, fix later
    cyanLight: '#00B5CC',
    cyanLightSoft: '#e1fcff94',
    cyanLightPale: '#e1fcff94',

    blue: '#5073C6',
    blueSoft: '#E7EDF7',
    bluePale: 'linear-gradient(90deg, #f3f7ff 0%, #f5f8ffb5 100%);',

    purple: '#7d519e',
    purpleSoft: '#f7d8fd38',
    purplePale: 'linear-gradient(90deg, #f7d8fd38 0%, #f5e5f838 100%)',

    grey: '#106d8a',

    pink: '#b36976',
    pinkSoft: '#ffd8ea59',
    pinkPale: '#ffd8ea59',

    black: '#333333',
    blackBtn: '',
    blackSoft: '#f4f4f4',
    blackPale: '#f4f4f4',
  },
  grey: {
    rare: '#fafafa',
    middle: '#F1F3F4',
    hard: '#F1F3F4',
  },
  shadow: {
    md: 'rgba(0, 0, 0, 0.03) 0px 6px 24px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px;',
    lg: '',
    xl: '',
    xxl: 'rgba(149, 157, 165, 0.2) 0px 8px 24px',
  },
  // inspired by https://endless.design/
  gradientBg: {
    purple: 'linear-gradient(152deg,#faf5ff9c 0%,rgb(222 198 243) 100%)',
    blue: 'linear-gradient(310deg,#f6f3ff54 13%,rgb(209 237 255 / 83%) 100%)',
    green: 'linear-gradient(28deg,#fffbf6 0%,rgb(216 240 221 / 80%) 100%)',
    orange: 'linear-gradient(244deg,#fffcf75e 0%,rgb(255 234 217 / 72%) 100%)',
    pink: 'linear-gradient(224deg,#fde4ff24 0%,rgb(255 223 234 / 79%) 100%)',
    black: 'linear-gradient(25deg,#fafafaba 20%,#bdccce63 100%)',
    cyan: 'linear-gradient(213deg,#fffff3ba 13%,#aff5ffc2 100%)',
    yellow: 'linear-gradient(150deg,#ffe5e529 20%,rgb(255 251 216 / 58%) 100%)',
  },
  text: {
    title: '',
    digest: '',
    body: '',
    hint: '',
    invert: '',
    link: '',
  },
  dot: '',
  article: {
    title: threadTitle,
    digest: descText,
    info: actionText,
    link,
  },
  content: {
    bg: contentBoxBg,
  },
  footer: {
    text: descText,
    hover: '#949CB5',
    title: '#77706B',
    bottomBg: '#252325',
    shadow: 'rgb(241 241 241) 0px 0px 50px 0px inset',
  },
  drawer: {
    mask: 'rgba(31, 34, 37, 0.15)',
    bg: contentBg,
    shadow: '-8px 8px 20px 11px rgb(143 143 143 / 2%)',
    shadowLite: '-8px 8px 20px 11px rgb(143 143 143 / 2%)',
    closerShadow: '-7px 4px 20px 0px rgb(143 143 143 / 2%)',
    border: 'transparent',
  },
  comment: {
    bg: contentBg,
    icon: 'grey',
    didIcon: 'orange',
    title: 'grey',
    username: '#7FA7AC',
    number: '#efbc60',
    floor: '#8590a6',
    reply: '#93b3b5',
    replyBg: '#f3f3f3',
    placeholder: '#8c94a3',
    filter: 'grey',
    filterActive: primaryColor,
    action: actionText,
    // mention text displayed in article
    mentionText: '#91a4b5',
    mentionTextBg: '#fcffdb',
    // mention popover background
    mentionBg: '#F9FCFC',
    mentionBorder: primaryColor,

    indentLine: '#E7E9ED',
    indentActive: '#B5BCCB',
  },
  editor: {
    title: '#7ea9ad',
    content: '#a6bebf',
    placeholder: '#B3CFD0',
    contentBg: '#F9FCFC',
    border: '#D6D6D6',
    borderActive: descText,
    borderNormal: '#e2eaea',
    footer: '#a6bebf',
  },
  code: {
    bg: darken(contentBoxBg, 5),
  },
  button: {
    primary: primaryColor,
    toggle: 'white',
    redBg: '#fff9f8',
    fg: 'white',
    hoverBg: lighten(primaryColor, 10),
    upvoteBorder: '#c5c5c5b0',
  },
  navigator: {
    activeBottom: primaryColor,
    borderRight: darken(bannerBg, 5),
    hoverBg: '#eee',
  },
  popover: {
    bg: '#fafafa', // '#f6f6f6', // '#fafafa', // '#fffffff2',
    borderColor: '#e9e9ea',
    boxShadow: '-3px 2px 20px 0px rgb(58 58 58 / 15%)',
    activeBorder: '#70707094',
  },
  tags: {
    text: descText,
  },
  tagger: {
    text: '#d2a05f',
    bg: '#fff2b3',
    border: '#fff2b3',
    closeBtn: '#d2a05f',
  },
  tabs: {
    headerActive: '#EB6224',
    header: '#b5b5b5',
    contentBg: '#FFFFFF',
    headerBg: '#F7F9F9',
    headerActiveTop: primaryColor,
    border: '#E8E8E8',
    bottomLine: '#E1E4E8',
  },
  modal: {
    bg: contentBoxBg,
    mask: 'rgba(31, 34, 37, 0.1)',
    border: primaryColor,
    shadow: '-2px 4px 20px 0px rgb(158 157 157 / 23%)',
    innerSelectBg: '#e4eeed45',
    subPanel: '#F5F5F5',
  },
  form: {
    inputBg: '#ffffff95',
    text: '#88a4ad',
    label: '#88a4ad',
    border: '#B8C6C0',
    shadow: 'rgba(184, 198, 192, 0.3)',
  },
  a: {
    hover: primaryColor,
    active: darken(primaryColor, 10),
  },
  toast: {
    bg: contentBoxBg,
    border,
    title: threadTitle,
  },
  table: {
    headerBg: '#F8F8F8',
    headTitle: '#949494',
    text: '#949497',
    border: '#F0F0F0',
    hoverBg: '#FAFBFC',
  },
  avatar: {
    opacity: 1,
    quote: '#217470',
    shadow: '0px 0px 4px 0px rgb(0 0 0 / 50%) inset',
  },
  dashboard: {
    menuCat: threadTitle,
    menuTitle: descText,
    blockActiveBg: '#ffffff95',
  },
  toggle: {
    shadow: '0 0 10px 0 rgb(185 185 185 / 25%) inset',
    ball: 'white',
  },
  hiddenPanel: 'linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 1) 40%)',
}
