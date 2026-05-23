import { gql } from 'urql'

export const saveCustomThemePreset = gql`
  mutation (
    $community: String!
    $themePreset: DsbThemePreset!
    $themePresetBase: DsbThemePreset!
    $themeTokens: Json
  ) {
    saveCustomThemePreset(
      community: $community
      themePreset: $themePreset
      themePresetBase: $themePresetBase
      themeTokens: $themeTokens
    ) {
      slug
    }
  }
`

export const selectThemePreset = gql`
  mutation ($community: String!, $themePreset: DsbThemePreset!) {
    selectThemePreset(community: $community, themePreset: $themePreset) {
      slug
    }
  }
`
