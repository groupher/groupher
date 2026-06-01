import { gql } from 'urql'

import { F } from '~/schemas'

const updateDashboardWallpaper = gql`
  mutation ($community: String!, $wallpaper: DsbWallpaperInput!) {
    updateDashboardWallpaper(community: $community, wallpaper: $wallpaper) {
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
