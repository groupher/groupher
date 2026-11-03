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
  id: 'hardware',
  label: 'Share updates',
  themePreset: BASE_THEME_PRESET,
  appearance: BASE_APPEARANCE,
  wallpaper: {
    light: {
      type: WALLPAPER_TYPE.PATTERN,
      source: 'swt',
      assets: publishedProfiles(picture('swt')),
      preview: preview('swt'),
      cover: picture('swt'),
    },
    dark: {
      type: WALLPAPER_TYPE.PATTERN,
      source: 'swt',
      assets: publishedProfiles(picture('swt')),
      preview: preview('swt'),
      cover: picture('swt'),
    },
  },
})
