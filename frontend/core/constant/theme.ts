export enum THEME_MODE {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

const THEME = {
  LIGHT: THEME_MODE.LIGHT,
  DARK: THEME_MODE.DARK,
} as const

export default THEME

export const LOCAL_THEME_KEY = 'theme'
