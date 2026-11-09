import { LANDING_INIT_DATA } from '~/const/name'
import { WALLPAPER_TYPE } from '~/const/wallpaper'

import { BASE_APPEARANCE, BASE_THEME_PRESET, defineScene } from './shared'

export default defineScene({
  id: 'feedback',
  label: 'Collect feedback',
  themePreset: BASE_THEME_PRESET,
  appearance: BASE_APPEARANCE,
  wallpaper: {
    light: {
      type: WALLPAPER_TYPE.GRADIENT,
      source: 'amber_mauve',
      assets: LANDING_INIT_DATA.wallpaper.wallpaper.light!,
      preview: '/landing/wallpaper/amber-mauve-phone.webp',
      cover: '/landing/wallpaper/amber-mauve-wide.webp',
    },
    dark: {
      type: WALLPAPER_TYPE.GRADIENT,
      source: 'amber_mauve',
      assets: LANDING_INIT_DATA.wallpaper.wallpaper.dark!,
      preview: '/landing/wallpaper/amber-mauve-phone.webp',
      cover: '/landing/wallpaper/amber-mauve-wide.webp',
    },
  },
  wallpaperPanAxis: 'y',
})
