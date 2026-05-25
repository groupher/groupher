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
`

export const selectThemePreset = gql`
  mutation ($community: String!, $themePreset: DsbThemePreset!) {
    selectThemePreset(community: $community, themePreset: $themePreset) {
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
`
