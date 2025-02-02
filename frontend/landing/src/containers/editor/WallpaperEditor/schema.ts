import { gql } from 'urql'
import { F } from '~/schemas'

const updateDashboardWallpaper = gql`
  mutation (
    $community: String!
    $wallpaper: String
    $wallpaperType: String
    $direction: String
    $customColorValue: String
    $bgSize: String
    $uploadBgImage: String
    $hasPattern: Boolean
    $hasBlur: Boolean
    $hasShadow: Boolean
  ) {
    updateDashboardWallpaper(
      community: $community
      wallpaper: $wallpaper
      wallpaperType: $wallpaperType
      direction: $direction
      customColorValue: $customColorValue
      bgSize: $bgSize
      uploadBgImage: $uploadBgImage
      hasPattern: $hasPattern
      hasBlur: $hasBlur
      hasShadow: $hasShadow
    ) {
      slug
      dashboard {
        wallpaper {
          ${F.wallpaper}
        }
      }
    }
  }
`

const schema = {
  updateDashboardWallpaper,
}

export default schema
