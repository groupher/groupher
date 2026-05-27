import { gql } from 'urql'

import { F } from '~/schemas'

const updateDashboardWallpaper = gql`
  mutation (
    $community: String!
    $source: String
    $type: String
    $direction: String
    $customColorValue: String
    $bgSize: String
    $hasPattern: Boolean
    $blurIntensity: Int
    $hasShadow: Boolean
    $brightness: Int
    $saturation: Int
    $textureType: String
    $textureStrength: Int
  ) {
    updateDashboardWallpaper(
      community: $community
      source: $source
      type: $type
      direction: $direction
      customColorValue: $customColorValue
      bgSize: $bgSize
      hasPattern: $hasPattern
      blurIntensity: $blurIntensity
      hasShadow: $hasShadow
      brightness: $brightness
      saturation: $saturation
      textureType: $textureType
      textureStrength: $textureStrength
    ) {
      wallpaper {
        ${F.wallpaper}
      }
    }
  }
`

const schema = {
  updateDashboardWallpaper,
}

export default schema
