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
  id: 'inspiration',
  label: 'Inspire ideas',
  themePreset: BASE_THEME_PRESET,
  appearance: BASE_APPEARANCE,
  wallpaper: {
    light: {
      type: WALLPAPER_TYPE.PATTERN,
      source: 'backiee-3',
      assets: publishedProfiles(picture('backiee-3')),
      preview: preview('backiee-3'),
      cover: picture('backiee-3'),
    },
    dark: {
      type: WALLPAPER_TYPE.PATTERN,
      source: 'backiee-3',
      assets: publishedProfiles(picture('backiee-3')),
      preview: preview('backiee-3'),
      cover: picture('backiee-3'),
    },
  },
})
