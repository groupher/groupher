import type { TWallpaper } from '~/spec'

const DIR = '/wallpaper'

export const WALLPAPER_TYPE = {
  PATTERN: 'pattern',
  GRADIENT: 'gradient',
  CUSTOM_GRADIENT: 'custom_gradient',
  UPLOAD: 'upload',
  NONE: 'none',
} as const

export const PATTERN_WALLPAPER = {
  // bubbles: {
  //   bgImage: `${DIR}/bubbles.png`,
  // },
  // limones: {
  //   bgImage: `${DIR}/limones.jpeg`,
  // },
  country1: {
    bgImage: `${DIR}/country-1.webp`,
    // bgSize: 'cover',
  },
  // curves: {
  //   bgImage: `${DIR}/curves.png`,
  //   bgColor: '#050139', // backgroundBg or fallback
  // },
  newspaper: {
    bgImage: `${DIR}/newspaper.jpeg`,
  },
  rainbow: {
    bgImage: `${DIR}/rainbow.jpeg`,
  },
  // fishes: {
  //   bgImage: `${DIR}/fishes.jpeg`,
  // },
  // space: {
  //   bgImage: `${DIR}/space.svg`,
  //   bgColor: '#002630',
  // },
  earth: {
    bgImage: `${DIR}/earth.jpg`,
  },
  // code: {
  //   bgImage: `${DIR}/code.jpg`,
  // },
  plane: {
    bgImage: `${DIR}/plane.webp`,
    // bgSize: 'cover',
  },
  idian: {
    bgImage: `${DIR}/idian.webp`,
  },
  // elec: {
  //   bgImage: `${DIR}/elec.jpg`,
  // },
  co2: {
    bgImage: `${DIR}/co2.jpeg`,
  },
  cartoon: {
    bgImage: `${DIR}/cartoon.jpeg`,
  },

  mac: {
    bgImage: `${DIR}/mp_teal.jpg`,
  },

  // ms: {
  //   bgImage: `${DIR}/ms.svg`,
  //   bgSize: 'cover',
  // },
  // istanbul: {
  //   bgImage: `${DIR}/istanbul.jpeg`,
  // },
}

// demo: `
//     background: url(${DIR}/patterns/1.png) repeat, linear-gradient(to bottom, #C6D183, #72B58C);
//   `,

const DEFAULT_GRADIENT_EFFECT = {
  hasPattern: false,
  hasBlur: false,
  direction: 'bottom',
}

export const GRADIENT_WALLPAPER_NAME = {
  PINK: 'pink',
  GREEN: 'green',
  ORANGE: 'orange',
  PURPLE: 'purple',
  GREY: 'grey',
  BLUE: 'blue',
}

export const GRADIENT_WALLPAPER = {
  // linear gradian
  // background: #2c3e50; /* fallback for old browsers */
  // background: -webkit-linear-gradient(#C6D183, #72B58C); /* Chrome 10-25, Safari 5.1-6 */
  [GRADIENT_WALLPAPER_NAME.PINK]: {
    colors: ['#FBEFDE', '#D8B9E3'],
    ...DEFAULT_GRADIENT_EFFECT,
    hasBlur: true,
  },

  [GRADIENT_WALLPAPER_NAME.GREEN]: {
    colors: ['#D6D9B8', '#87BB89'],
    ...DEFAULT_GRADIENT_EFFECT,
    hasPattern: true,
  },

  [GRADIENT_WALLPAPER_NAME.ORANGE]: {
    colors: ['#ffefc4', '#c06577'],
    ...DEFAULT_GRADIENT_EFFECT,
    hasPattern: true,
  },
  [GRADIENT_WALLPAPER_NAME.PURPLE]: {
    colors: ['#69999F', '#6B80A7', '#8C8EBB'],
    ...DEFAULT_GRADIENT_EFFECT,
  },
  [GRADIENT_WALLPAPER_NAME.GREY]: {
    colors: ['#EEEBE8', '#E7E2DD', '#dccfc2'],
    ...DEFAULT_GRADIENT_EFFECT,
  },
  [GRADIENT_WALLPAPER_NAME.BLUE]: {
    colors: ['#daf3fb', '#B8D1FA', '#c7bbf2', '#6390c5'],
    ...DEFAULT_GRADIENT_EFFECT,
  },
} as Record<string, TWallpaper>

export const GRADIENT_DIRECTION = {
  TOP: 'top',
  TOP_RIGHT: 'top right',
  RIGHT: 'right',
  BOTTOM_RIGHT: 'bottom right',
  BOTTOM: 'bottom',
  BOTTOM_LEFT: 'bottom left',
  LEFT: 'left',
  TOP_LEFT: 'top left',
} as const
