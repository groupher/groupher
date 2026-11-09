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
  id: 'creative',
  label: 'Tell your story',
  themePreset: BASE_THEME_PRESET,
  appearance: BASE_APPEARANCE,
  wallpaper: {
    light: {
      type: WALLPAPER_TYPE.PATTERN,
      source: 'backiee-6',
      assets: publishedProfiles(picture('backiee-6')),
      preview: preview('backiee-6'),
      cover: picture('backiee-6'),
    },
    dark: {
      type: WALLPAPER_TYPE.PATTERN,
      source: 'backiee-6',
      assets: publishedProfiles(picture('backiee-6')),
      preview: preview('backiee-6'),
      cover: picture('backiee-6'),
    },
  },
})
