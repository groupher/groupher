import { WALLPAPER_TYPE } from '~/const/wallpaper'

import {
  BASE_APPEARANCE,
  BASE_THEME_PRESET,
  defineScene,
  publishedProfiles,
  gradient,
} from './shared'

export default defineScene({
  id: 'software',
  label: 'Build software',
  themePreset: BASE_THEME_PRESET,
  appearance: BASE_APPEARANCE,
  wallpaper: {
    light: {
      type: WALLPAPER_TYPE.GRADIENT,
      source: 'stone_green',
      assets: publishedProfiles(gradient('stone_green')),
      preview: gradient('stone_green'),
      cover: gradient('stone_green'),
    },
    dark: {
      type: WALLPAPER_TYPE.GRADIENT,
      source: 'stone_green',
      assets: publishedProfiles(gradient('stone_green')),
      preview: gradient('stone_green'),
      cover: gradient('stone_green'),
    },
  },
})
