import { graphql } from '~/graphql/authoring'

export const DashboardWallpaperFields = graphql(`
  fragment DashboardWallpaperFields on DsbWallpaper {
    light {
      type
      source
      gradient
      pattern
      contentShadow
      effect
      texture
    }
    dark {
      type
      source
      gradient
      pattern
      contentShadow
      effect
      texture
    }
  }
`)
