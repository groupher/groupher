import { gql } from 'urql'

import { F } from '~/schemas'

const updateDashboardWallpaper = gql`
  mutation (
    $community: String!
    $source: String
    $type: String
    $gradient: Json
    $bgSize: String
    $hasPattern: Boolean
    $patternId: String
    $hasTexture: Boolean
    $blurIntensity: Int
    $hasShadow: Boolean
    $brightness: Int
    $saturation: Int
    $texture: Json
  ) {
    updateDashboardWallpaper(
      community: $community
      source: $source
      type: $type
      gradient: $gradient
      bgSize: $bgSize
      hasPattern: $hasPattern
      patternId: $patternId
      hasTexture: $hasTexture
      blurIntensity: $blurIntensity
      hasShadow: $hasShadow
      brightness: $brightness
      saturation: $saturation
      texture: $texture
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
