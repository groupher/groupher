import { graphql } from '~/graphql/authoring'

export const saveCustomThemePreset = graphql(`
  mutation SaveCustomThemePreset(
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
`)

export const selectThemePreset = graphql(`
  mutation SelectThemePreset($community: String!, $themePreset: DsbThemePreset!) {
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
`)
