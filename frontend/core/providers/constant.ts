import METRIC from '~/const/metric'
import { HCN } from '~/const/name'
import THEME from '~/const/theme'

import type { TRootStoreInit } from '~/stores/spec'

export const LANDING_SSR_INFO = {
  theme: THEME.LIGHT,
  articles: {},
  viewing: {
    metric: METRIC.LANDING,
    community: {
      slug: HCN,
      homepage: '',
      desc: '',
      meta: { postsCount: 0, docsCount: 0, blogsCount: 0, changelogsCount: 0 },
      dashboard: {},
    },
  },
  wallpaper: undefined,
  dashboard: undefined,
} satisfies TRootStoreInit
