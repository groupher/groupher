import { gql } from 'urql'

export const saveCustomThemePreset = gql`
  mutation (
    $community: String!
    $themePreset: DsbThemePreset!
    $themePresetBase: DsbThemePreset!
    $themeTokens: Json
    $textTitle: String
    $textTitleDark: String
    $textDigest: String
    $textDigestDark: String
    $gaussBlur: Float
    $gaussBlurDark: Float
  ) {
    saveCustomThemePreset(
      community: $community
      themePreset: $themePreset
      themePresetBase: $themePresetBase
      themeTokens: $themeTokens
      textTitle: $textTitle
      textTitleDark: $textTitleDark
      textDigest: $textDigest
      textDigestDark: $textDigestDark
      gaussBlur: $gaussBlur
      gaussBlurDark: $gaussBlurDark
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
