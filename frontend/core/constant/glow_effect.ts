import { keys } from 'ramda'

import THEME from '~/const/theme'

export const GLOW_EFFECT_NAME = {
  ORANGE_PURPLE: 'ORANGE_PURPLE',
  GREY_BROWN: 'GREY_BROWN',
  YELLOW_RED: 'YELLOW_RED',
  GREY_GREEN: 'GREY_GREEN',
  PURPLE_BLUE: 'PURPLE_BLUE',
  PASTEL_RAINBOW: 'PASTEL_RAINBOW',
}

export const GLOW_EFFECTS_DAY = {
  ORANGE_PURPLE: {
    LEFT: {
      COLOR: '#f39e8d26',
      X: '25%',
      Y: '-16%',
      RADIUS: '30%',
    },
    RIGHT1: {
      COLOR: '#ffeba824',
      X: '100%',
      Y: '0',
      RADIUS: '40%',
    },
    MAIN: {
      COLOR: '#4e4bd212',
      X: '78%',
      Y: '4%',
      RADIUS: '40%',
    },
    RIGHT2: {
      COLOR: '#961fb314',
      X: '90%',
      Y: '15%',
      RADIUS: '30%',
    },
  },
  GREY_BROWN: {
    LEFT: {
      COLOR: '#e7dcd08a',
      X: '20%',
      Y: '-16%',
      RADIUS: '30%',
    },
    RIGHT1: {
      COLOR: '#d4003f03',
      X: '100%',
      Y: '0',
      RADIUS: '40%',
    },

    MAIN: {
      COLOR: '#ff980012',
      X: '72%',
      Y: '4%',
      RADIUS: '40%',
    },
    RIGHT2: {
      COLOR: '#f6c49f1c',
      X: '80%',
      Y: '18%',
      RADIUS: '30%',
    },
  },
  YELLOW_RED: {
    LEFT: {
      COLOR: '#ffc43b2b',
      X: '20%',
      Y: '-16%',
      RADIUS: '30%',
    },
    RIGHT1: {
      COLOR: '#d4003f03',
      X: '100%',
      Y: '0',
      RADIUS: '40%',
    },

    MAIN: {
      COLOR: '#f4433621',
      X: '78%',
      Y: '4%',
      RADIUS: '40%',
    },
    RIGHT2: {
      COLOR: '#ff98000a',
      X: '90%',
      Y: '15%',
      RADIUS: '30%',
    },
  },
  GREY_GREEN: {
    LEFT: {
      COLOR: '#f3f0dfe3',
      X: '30%',
      Y: '-16%',
      RADIUS: '30%',
    },
    RIGHT1: {
      COLOR: '#e9ede000',
      X: '100%',
      Y: '0',
      RADIUS: '40%',
    },
    MAIN: {
      COLOR: '#e9ede0a6',
      X: '78%',
      Y: '4%',
      RADIUS: '40%',
    },
    RIGHT2: {
      COLOR: '#fefdf629',
      X: '90%',
      Y: '15%',
      RADIUS: '30%',
    },
  },
  PURPLE_BLUE: {
    LEFT: {
      COLOR: '#e2eaf58f',
      X: '28%',
      Y: '-8%',
      RADIUS: '26%',
    },
    RIGHT1: {
      COLOR: '#91dfe900',
      X: '100%',
      Y: '0',
      RADIUS: '40%',
    },
    MAIN: {
      COLOR: '#d5e9fb59',
      X: '70%',
      Y: '4%',
      RADIUS: '35%',
    },
    RIGHT2: {
      COLOR: '#d5e9fb70',
      X: '85%',
      Y: '15%',
      RADIUS: '30%',
    },
  },
  PASTEL_RAINBOW: {
    LEFT: {
      COLOR: '#b7f4f24f',
      X: '6%',
      Y: '-10%',
      RADIUS: '42%',
    },
    RIGHT1: {
      COLOR: '#fff0c64a',
      X: '50%',
      Y: '-8%',
      RADIUS: '44%',
    },
    MAIN: {
      COLOR: '#ffd4d94f',
      X: '88%',
      Y: '-8%',
      RADIUS: '42%',
    },
    RIGHT2: {
      COLOR: '#eff3d73d',
      X: '72%',
      Y: '16%',
      RADIUS: '45%',
    },
  },
}

export const GLOW_EFFECTS_NIGHT = {
  ORANGE_PURPLE: {
    LEFT: {
      COLOR: '#f39e8d26',
      X: '25%',
      Y: '-16%',
      RADIUS: '30%',
    },
    RIGHT1: {
      COLOR: '#ffeba824',
      X: '100%',
      Y: '0',
      RADIUS: '40%',
    },
    MAIN: {
      COLOR: '#4e4bd212',
      X: '78%',
      Y: '4%',
      RADIUS: '40%',
    },
    RIGHT2: {
      COLOR: '#961fb314',
      X: '90%',
      Y: '15%',
      RADIUS: '30%',
    },
  },
  GREY_BROWN: {
    LEFT: {
      COLOR: '#5f564c8a',
      X: '20%',
      Y: '-16%',
      RADIUS: '30%',
    },
    RIGHT1: {
      COLOR: '#d4003f03',
      X: '100%',
      Y: '0',
      RADIUS: '40%',
    },

    MAIN: {
      COLOR: '#ff980012',
      X: '72%',
      Y: '4%',
      RADIUS: '40%',
    },
    RIGHT2: {
      COLOR: '#f6c49f1c',
      X: '80%',
      Y: '18%',
      RADIUS: '30%',
    },
  },
  YELLOW_RED: {
    LEFT: {
      COLOR: '#ffc43b2b',
      X: '20%',
      Y: '-16%',
      RADIUS: '30%',
    },
    RIGHT1: {
      COLOR: '#d4003f03',
      X: '100%',
      Y: '0',
      RADIUS: '40%',
    },

    MAIN: {
      COLOR: '#f4433621',
      X: '78%',
      Y: '4%',
      RADIUS: '40%',
    },
    RIGHT2: {
      COLOR: '#ff98000a',
      X: '90%',
      Y: '15%',
      RADIUS: '30%',
    },
  },
  GREY_GREEN: {
    LEFT: {
      COLOR: '#444b428a',
      X: '30%',
      Y: '-16%',
      RADIUS: '30%',
    },
    RIGHT1: {
      COLOR: '#30381fa6',
      X: '100%',
      Y: '0',
      RADIUS: '40%',
    },
    MAIN: {
      COLOR: '#2e3323a6',
      X: '78%',
      Y: '4%',
      RADIUS: '40%',
    },
    RIGHT2: {
      COLOR: '#363c2978',
      X: '90%',
      Y: '15%',
      RADIUS: '30%',
    },
  },
  PURPLE_BLUE: {
    LEFT: {
      COLOR: '#323d498f',
      X: '28%',
      Y: '-8%',
      RADIUS: '26%',
    },
    RIGHT1: {
      COLOR: '#2b36489e',
      X: '100%',
      Y: '0',
      RADIUS: '40%',
    },
    MAIN: {
      COLOR: '#12283c59',
      X: '70%',
      Y: '4%',
      RADIUS: '35%',
    },
    RIGHT2: {
      COLOR: '#0e2b4670',
      X: '85%',
      Y: '15%',
      RADIUS: '30%',
    },
  },
  PASTEL_RAINBOW: {
    LEFT: {
      COLOR: '#25d7d84d',
      X: '8%',
      Y: '-10%',
      RADIUS: '38%',
    },
    RIGHT1: {
      COLOR: '#e6ae5248',
      X: '48%',
      Y: '-10%',
      RADIUS: '40%',
    },
    MAIN: {
      COLOR: '#ff5f7a4d',
      X: '88%',
      Y: '-8%',
      RADIUS: '40%',
    },
    RIGHT2: {
      COLOR: '#8f5cff3d',
      X: '72%',
      Y: '10%',
      RADIUS: '42%',
    },
  },
}

export const GLOW_EFFECTS_KEYS = keys(GLOW_EFFECTS_DAY)

export type TGlowEffectName = keyof typeof GLOW_EFFECTS_DAY
export type TGlowEffect = (typeof GLOW_EFFECTS_DAY)[TGlowEffectName]

export const resolveGlowEffect = (
  glowType: string | null | undefined,
  theme: string,
): TGlowEffect | null => {
  if (!glowType) return null

  const effects = theme === THEME.LIGHT ? GLOW_EFFECTS_DAY : GLOW_EFFECTS_NIGHT

  if (!(GLOW_EFFECTS_KEYS as readonly string[]).includes(glowType)) return null

  return effects[glowType as TGlowEffectName]
}

export const buildGlowBackground = (glow: TGlowEffect | null): string => {
  if (!glow) return ''

  return `
      radial-gradient(circle at ${glow.LEFT.X} ${glow.LEFT.Y}, ${glow.LEFT.COLOR} 0, transparent ${glow.LEFT.RADIUS}),
      radial-gradient(circle at ${glow.RIGHT1.X} ${glow.RIGHT1.Y}, ${glow.RIGHT1.COLOR} 0, transparent ${glow.RIGHT1.RADIUS}),
      radial-gradient(circle at ${glow.MAIN.X} ${glow.MAIN.Y}, ${glow.MAIN.COLOR} 0, transparent ${glow.MAIN.RADIUS}),
      radial-gradient(circle at ${glow.RIGHT2.X} ${glow.RIGHT2.Y}, ${glow.RIGHT2.COLOR} 0, transparent ${glow.RIGHT2.RADIUS})
    `
}

const TEXTURE_GLOW_ALPHA = '82'

const previewGlowColor = (color: string): string => {
  if (!/^#[\dA-Fa-f]{8}$/.test(color)) return color

  return `${color.slice(0, 7)}${TEXTURE_GLOW_ALPHA}`
}

export const buildGlowPreviewBackground = (glow: TGlowEffect | null): string => {
  if (!glow) return ''

  return `
      radial-gradient(circle at 18% 8%, ${previewGlowColor(glow.LEFT.COLOR)} 0, transparent 62%),
      radial-gradient(circle at 72% 8%, ${previewGlowColor(glow.MAIN.COLOR)} 0, transparent 68%),
      radial-gradient(circle at 94% 20%, ${previewGlowColor(glow.RIGHT2.COLOR)} 0, transparent 52%)
    `
}
