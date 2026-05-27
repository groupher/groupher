import { gql } from 'urql'

import { F } from '~/schemas'

const updateDashboardWallpaper = gql`
  mutation (
    $community: String!
    $source: String
    $type: String
    $gradientDeg: Int
    $mesh: Json
    $bgSize: String
    $hasPattern: Boolean
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
      gradientDeg: $gradientDeg
      mesh: $mesh
      bgSize: $bgSize
      hasPattern: $hasPattern
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
