import { graphql } from '~/graphql/authoring'

const updateDashboardWallpaper = graphql(`
  mutation UpdateDashboardWallpaper($community: String!, $wallpaper: DsbWallpaperInput!) {
    updateDashboardWallpaper(community: $community, wallpaper: $wallpaper) {
      wallpaper {
        ...DashboardWallpaperFields
      }
    }
  }
`)

export default {
  updateDashboardWallpaper,
}
