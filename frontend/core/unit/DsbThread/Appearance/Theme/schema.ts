import { graphql } from '~/graphql/authoring'

export const saveCustomThemePreset = graphql(`
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
