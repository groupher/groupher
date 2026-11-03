import { WALLPAPER_TYPE } from '~/const/wallpaper'

import {
  BASE_APPEARANCE,
  BASE_THEME_PRESET,
  defineScene,
  publishedProfiles,
  picture,
  preview,
} from './shared'

export default defineScene({
  id: 'growth',
  label: 'Grow together',
  themePreset: BASE_THEME_PRESET,
  appearance: BASE_APPEARANCE,
  wallpaper: {
    light: {
      type: WALLPAPER_TYPE.PATTERN,
      source: 'backiee-4',
      assets: publishedProfiles(picture('backiee-4')),
      preview: preview('backiee-4'),
      cover: picture('backiee-4'),
    },
    dark: {
      type: WALLPAPER_TYPE.PATTERN,
      source: 'backiee-4',
      assets: publishedProfiles(picture('backiee-4')),
      preview: preview('backiee-4'),
      cover: picture('backiee-4'),
    },
  },
})
