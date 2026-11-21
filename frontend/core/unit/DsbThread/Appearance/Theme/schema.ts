import { graphql } from '~/graphql/authoring'

export const saveCustomThemePreset = graphql(`
  "Save custom theme preset in dashboard"
  mutation SaveCustomThemePreset(
    $community: String!
    $commandId: ID!
    $themePreset: DsbThemePreset!
    $themePresetBase: DsbThemePreset!
    $themeOverwrite: Json
  ) {
    saveCustomThemePreset(
      community: $community
      commandId: $commandId
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
  "Select read-only theme preset in dashboard"
  mutation SelectThemePreset($community: String!, $commandId: ID!, $themePreset: DsbThemePreset!) {
    selectThemePreset(community: $community, commandId: $commandId, themePreset: $themePreset) {
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
