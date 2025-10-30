/*
 * dark mode
 */
import { darken, lighten } from '~/utils/color'

const primaryColor = '#333333' // '#000000'
const bannerBg = '#222222' //  '#161616'
const contentBg = '#222222' // '#161616'
const contentBoxBg = '#222222' // '#161616'
const fontColor = primaryColor
const border = '#3c3c3c' // '#282828'
const link = '#418ccc'

const actionText = '#7f8695'
const descText = '#7c7f82'
const threadTitle = '#dddddd'
const hoverBg = '#42424259' // with alpha
const hint = '#9d9999'
// const primaryMate = 'orange'

export default {
  primary: primaryColor,
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
  alphaBg: hoverBg,
  alphaBg2: '#1c1c1cb8',
  hoverBg,
  hoverActive: '#3f3f3f',
  menuHoverBg: hoverBg,
  lineDivider: '#5a5a5ac9',
  savingBarBg: '#f7f7f7',
  hoverBorder: '#393939',
  linkHover: lighten(link, 5),
  heightIcon: '#e48a3d',
  heightGradient: 'linear-gradient(90deg, rgb(243, 170, 0) 0%, rgb(228, 62, 41) 100%)',
  bodyBg: contentBg,
  textBadge: '#e2e2e287', // with alpha
  lightText: '#999999',
  hint,
  articleCardShadow: '0 2px 40px 0 rgb(62 62 62 / 27%))',
  articleCardHover: '#575757',
  dashboardBlockOpacity: 0.7,

  rainbow: {
    red: '#ca5f4d',
    redSoft: '#7d3b363d',
    redPale: 'linear-gradient(90deg, #7a37323d 0%, #46211e2b 100%)',

    orange: '#ce9f6f',
    orangeSoft: '#4c3e37',
    orangePale: 'linear-gradient(90deg, #44352ead 0%, #382c27a1 100%)',

    brown: '#8d691e',
    brownSoft: '#3a342b',
    brownPale: 'linear-gradient(90deg, #45320569 0%, #3929024a 100%)',

    yellow: '#eddd85',
    yellowSoft: '#a9a06a30',
    yellowPale: 'linear-gradient(90deg, #635e184d 0%, #433e2330 100%)',

    green: '#699411',
    greenSoft: '#8a97764a',
    greenPale: 'linear-gradient(90deg, #636e534a 0%, #474e3c36 100%)',

    greenLight: '#37B784',
    greenLightSoft: '#69735a4a',
    greenLightPale: 'linear-gradient(90deg, #636e534a 0%, #474e3c36 100%)',

    cyan: '#24878C',
    cyanSoft: '#2c3738',
    cyanPale: 'linear-gradient(90deg, #2c3738 0%, #2c37386e 100%)',

    // naming, fix later
    cyanLight: '#00B5CC',
    cyanLightSoft: '#39494b94',
    cyanLightPale: '#39494b94',

    blue: '#0073E3',
    blueSoft: '#76809654',
    bluePale: 'linear-gradient(90deg, #505a7254 0%, #3a415038 100%)',

    purple: '#7d519e',
    purpleSoft: '#7c618238',
    purplePale: 'linear-gradient(90deg, #86539147  0%, #58445d38 100%)',

    pink: '#b36976',
    pinkSoft: '#73526159',
    pinkPale: '#73526159',

    black: '#343333',
    blackBtn: '',
    blackSoft: '#313131',
    blackPale: '#313131',
  },
  shadow: {
    md: 'rgba(0, 0, 0, 0.03) 0px 6px 24px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px;',
    lg: '',
    xl: '',
    xxl: 'rgb(21 21 21 / 48%) 0px 11px 24px;',
  },
  gradientBg: {
    purple: 'linear-gradient(-149deg,#373439d4 0%,rgb(86 70 99) 100%)',
    blue: 'linear-gradient(310deg,#303435 13%,rgb(49 84 121 / 83%) 100%)',
    green: 'linear-gradient(133deg,#343434 0%,rgb(58 83 63 / 80%) 100%)',
    orange: 'linear-gradient(244deg,#3d3d3d 0%,rgb(106 82 62 / 72%) 100%)',
    pink: 'linear-gradient(140deg,#fff5fb99 0%,rgb(255 231 230 / 84%) 100%)',
    black: 'linear-gradient(220deg,#fafafaba 0%,#ededede3 100%)',
    cyan: 'linear-gradient(310deg,#eafffe7a 13%,rgb(183 242 246 / 46%) 100%)',
    yellow: 'linear-gradient(53deg,#fffff37a 13%,rgb(255 244 140 / 25%) 100%)',
  },
  article: {
    title: threadTitle,
    digest: descText,
    info: descText,
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
    shadow: 'rgb(25 25 25) 0px 0px 50px 0px inset',
  },
  drawer: {
    mask: 'rgb(31 34 37 / 41%)',
    bg: '#252525',
    shadow: '-13px 1px 20px 11px rgb(0 0 0 / 9%)',
    shadowLite: '-5px 5px 20px 11px rgb(13 13 13 / 14%)',
    closerShadow: '-3px 12px 20px 0px rgb(32 29 29 / 83%)',
    border: '#363636',
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
    border: '#414141',
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
    upvoteBorder: '#5f5f5fb5',
  },
  navigator: {
    activeBottom: primaryColor,
    borderRight: darken(bannerBg, 5),
    hoverBg: '#eee',
  },
  notice: {
    bg: '',
    icon: '',
  },
  popover: {
    bg: '#2e2e2ef0',
    borderColor: border,
    boxShadow: '-9px 7px 20px 9px rgb(24 24 24 / 44%)',
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
    mask: 'rgba(31, 34, 37, 0.55)',
    border: primaryColor,
    shadow: '-4px 5px 20px 5px rgb(21 21 21 / 47%)',
    innerSelectBg: '#e4eeed45',
    subPanel: '#1b1b1b',
  },
  form: {
    inputBg: '#1f1f1f7a',
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
    bg: '#2c2c2c',
    border,
    title: '#afafaf',
  },
  table: {
    headerBg: '#F8F8F8',
    headTitle: '#949494',
    text: '#949497',
    border: '#F0F0F0',
    hoverBg: '#FAFBFC',
  },
  avatar: {
    quote: '#217470',
    shadow: '0px 0px 4px 0px rgb(0 0 0 / 50%) inset',
  },
  dashboard: {
    menuCat: '#c1c1c1',
    menuTitle: '#b7b7b7',
    blockActiveBg: '#2b2a2a7a',
  },
  toggle: {
    shadow: '0 0 20px 0px rgb(0 0 0 / 46%) inset',
    ball: '#ffffffb5',
  },
  hiddenPanel: 'linear-gradient(180deg, rgb(0 0 0 / 0%) 0%, rgb(35 35 35) 40%)',
}
