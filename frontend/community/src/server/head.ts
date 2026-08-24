import type { TCommunityShell } from '@community/server/community'

import { serializeCommunityThemePresetCss } from '~/lib/themePreset'

export type TCommunityHeadProjection = {
  description?: string
  feedSlug: string
  noIndex: boolean
  ogImage?: string
  ogSiteName?: string
  themeCssText: string
  title: string
  twitterCard?: string
  twitterImage?: string
  twitterSite?: string
}

/** Projects the complete community shell to the fields serialized in Router loader data. */
export const projectCommunityHead = (shell: TCommunityShell): TCommunityHeadProjection => ({
  description: shell.dashboard.ogDescription,
  feedSlug: shell.community.slug,
  noIndex: shell.dashboard.seoEnable === false,
  ogImage: shell.dashboard.ogImage,
  ogSiteName: shell.dashboard.ogSiteName,
  themeCssText: serializeCommunityThemePresetCss(shell.dashboard.themeTokens),
  title: shell.dashboard.ogTitle || shell.community.title || 'Groupher Community',
  twitterCard: shell.dashboard.twCard,
  twitterImage: shell.dashboard.twImage,
  twitterSite: shell.dashboard.twSite,
})
