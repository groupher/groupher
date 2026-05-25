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
    $hasBlur: Boolean
    $hasShadow: Boolean
  ) {
    updateDashboardWallpaper(
      community: $community
      source: $source
      type: $type
      direction: $direction
      customColorValue: $customColorValue
      bgSize: $bgSize
      hasPattern: $hasPattern
      hasBlur: $hasBlur
      hasShadow: $hasShadow
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
