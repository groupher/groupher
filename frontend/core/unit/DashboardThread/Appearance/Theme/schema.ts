import { gql } from 'urql'

export const saveCustomThemePreset = gql`
  mutation (
    $community: String!
    $themePreset: DsbThemePreset!
    $themePresetBase: DsbThemePreset!
    $themeOverwrite: Json
  ) {
    saveCustomThemePreset(
      community: $community
      themePreset: $themePreset
      themePresetBase: $themePresetBase
      themeOverwrite: $themeOverwrite
    ) {
      slug
      dashboard {
        layout {
          themePreset
          themePresetBase
          themeTokens
          themePresets {
            value
            tokens
          }
        }
      }
    }
  }
`

export const selectThemePreset = gql`
  mutation ($community: String!, $themePreset: DsbThemePreset!) {
    selectThemePreset(community: $community, themePreset: $themePreset) {
      slug
      dashboard {
        layout {
          themePreset
          themePresetBase
          themeTokens
          themePresets {
            value
            tokens
          }
        }
      }
    }
  }
`
