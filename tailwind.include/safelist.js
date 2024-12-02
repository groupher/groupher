const { keys, uniq } = require('ramda')
const { borderSoft, container } = require('../utils/constant/twConfig.json')

const GENERAL = [
  'border-divider',
  'border-text-link',
  'border-text-hint',
  'border-text-digest',
  'article-hover-linear',
  'saving-bar-left-linear',
  'saving-bar-right-linear',
  'unibar-linear-mask',
  'count-highlight',
  'footer-inner-shadow',
  'sexy-border-20',
  'sexy-border-35',
  'sexy-border-40',
  'sexy-border-50',
  // TODO
  'shadow-sm',
  'shadow-md',
  'shadow-lg',
  'shadow-xl',
  'shape-shadow',
  //
  'hidden-panel',
]

const LANDING_GRADIENTS = [
  'purple',
  'blue',
  'pink',
  'red',
  'green',
  'black',
  'cyan',
  'orange',
  'yellow',
  'brown',
]

const TEXT_COLORS = [
  'text-title',
  'text-digest',
  'text-body',
  'text-hint',
  'text-invert',
  'text-link',
  'button-fg',
]
const BG_COLORS = [
  'dot',
  'text-digest',
  'text-link',
  'divider',
  'hoverBg',
  'sandBox',
  'htmlBg',
  'card',
  'cardAlpha',
  'popover-bg',
  'menuHoverBg',
  'alphaBg',
  'snackBar',
  'button-redBg',
  'button-toggle',
  'button-fg',
]
const FILL_COLORS = ['text-title', 'text-digest', 'button-fg', 'heightIcon', 'text-link']
// for fg,bg & fill
const RAINBOW_COLORS = [
  'black',
  'blackBtn',
  'pink',
  'red',
  'orange',
  'yellow',
  'brown',
  'green',
  'greenLight',
  'cyan',
  'blue',
  'purple',
]

const MARGIN = ['px', 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 10, 12]
const SIZE = [1.5, 2, 2.5, 3, 3.5, 4, 5, 6]

// fill-rainbow-red is mainly for delete buttons
const HOVERS = [
  'text-text-title',
  'fill-text-title',
  'fill-rainbow-red',
  'text-rainbow-red',
  'bg-rainbow-redBg',
  'bg-hoverBg',
  'bg-htmlBg',
  'bg-card',
  'bg-menuHoverBg',
  'bg-alphaBg2',
  'border-divider',
  'border-text-digest',
  // shadows
  'shadow-sm',
]

const INPUTS = ['border-text-digest']

const GROUP_HOVERS = ['text-text-title', 'fill-rainbow-red', 'fill-text-title', 'shadow-sm']
const MENU_GROUP_HOVERS = ['text-rainbow-red', 'fill-rainbow-red', 'fill-text-title']

const CONTAINERS = keys(container).map(
  (c) =>
    `container-${c} w-[${container[c].width}] pl-${container[c].pl} pr-${container[c].pr} -ml-${container[c].pl} mr-${container[c].pr}`,
)

const ROTATES = [6, 3, 2, 1, 1, 2, 3, 6, 2, 3, 1, 6]

const UTILS = [
  'border-transparent',
  'rounded-sm',
  'rounded-md',
  'bg-gradient-to-r to-transparent',

  'saturate-150',
  'brightness-125',
  'select-none',
  'touch-manipulation',
  'outline-none',
  'bg-none',
  'bg-transparent',
  'rounded-3xl',
  'hover-underline',
  'hidden',
  'group-hover/menubar:text-rainbow-red',
  'group-hover/menubar:text-rainbow-red-dark',
  'z-50',
]

module.exports = uniq([
  ...GENERAL.map((c) => `${c} ${c}-dark`),

  ...TEXT_COLORS.map((c) => `text-${c} text-${c}-dark`),
  ...BG_COLORS.map((c) => `bg-${c} bg-${c}-dark`),
  ...FILL_COLORS.map((c) => `fill-${c} fill-${c}-dark`),
  ...RAINBOW_COLORS.map(
    (c) =>
      `text-rainbow-${c} text-rainbow-${c}-dark
       hover:text-rainbow-${c} hover:text-rainbow-${c}-dark
       bg-rainbow-${c} bg-rainbow-${c}-dark 
       decoration-rainbow-${c} bg-rainbow-${c}-dark 
       hover:border-rainbow-${c} hover:border-rainbow-${c}-dark
       bg-rainbow-${c}Soft bg-rainbow-${c}Soft-dark fill-rainbow-${c} fill-rainbow-${c}-dark 
       hover:bg-rainbow-${c}Soft hover:bg-rainbow-${c}Soft-dark
       from-rainbow-${c}Soft from-rainbow-${c}Soft-dark 
       border-rainbow-${c} border-rainbow-${c}-dark
       border-rainbow-${c}/${borderSoft.opacity} border-rainbow-${c}-dark/${borderSoft.opacity_dark}
       hover:border-rainbow-${c}/${borderSoft.opacity} hover:border-rainbow-${c}-dark/${borderSoft.opacity_dark}
      `,
  ),

  ...LANDING_GRADIENTS.map(
    (c) => `landing-gradient-${c} landing-gradient-${c}-dark gradient-${c} gradient-${c}-dark`,
  ),

  ...MARGIN.map((c) => `mt-${c} mb-${c} ml-${c} mr-${c}`),
  ...SIZE.map((c) => `size-${c}`),

  ...HOVERS.map((c) => `hover:${c} hover:${c}-dark`),
  ...INPUTS.map((c) => `focus:${c} active:${c} focus:${c}-dark active:${c}-dark`),

  ...GROUP_HOVERS.map((c) => `group-hover:${c} group-hover:${c}-dark`),
  ...MENU_GROUP_HOVERS.map((c) => `group-hover/menubar:${c} group-hover/menubar:${c}-dark`),
  ...ROTATES.map((r) => `rotate-${r}`),

  ...CONTAINERS,
  ...UTILS,
])
