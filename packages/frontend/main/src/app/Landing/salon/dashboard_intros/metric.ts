import { DASHBOARD_ROUTE } from '~/const/route'

import type { TIntroTab } from '../../DashboardIntros/spec'

export const gradientColor = (tab: TIntroTab) => {
  switch (tab) {
    case DASHBOARD_ROUTE.LAYOUT: {
      // purple
      return 'linear-gradient(rgb(236 229 255 / 30%) 0%, rgb(255 255 255 / 96%) 100%)'
    }

    case DASHBOARD_ROUTE.POST: {
      // blue
      return 'linear-gradient(rgb(240 246 255 / 82%) 0%, rgb(255 255 255 / 96%) 100%)'
    }

    case DASHBOARD_ROUTE.SEO: {
      // cyan
      return 'linear-gradient(#e0feff66 0%, rgb(255 255 255) 100%)'
    }

    case DASHBOARD_ROUTE.TAGS: {
      return 'linear-gradient(#f6f7f3d9 0%, rgb(255 255 255) 100%)'
    }

    case DASHBOARD_ROUTE.ADMINS: {
      // red
      return 'linear-gradient(rgb(255 204 204 / 19%) 0%, rgb(255 255 255) 100%)'
    }
    case DASHBOARD_ROUTE.INOUT: {
      return 'linear-gradient(rgb(235 247 235 / 52%) 0%, rgb(255 255 255) 100%)'
    }
    case DASHBOARD_ROUTE.WIDGETS: {
      // yellow-grey
      return 'linear-gradient(rgb(233 226 212 / 24%) 0%, rgb(255 255 255 / 96%) 100%)'
    }

    case 'richeditor': {
      // yellow
      return 'linear-gradient(rgb(255 250 242 / 76%) 0%, rgb(255 255 255) 100%)'
    }

    case DASHBOARD_ROUTE.HEADER: {
      // brown
      return 'linear-gradient(rgb(231 206 195 / 12%) 0%, rgb(255 255 255) 100%)'
    }

    case DASHBOARD_ROUTE.TREND: {
      // trend
      return 'linear-gradient(180deg, rgb(247 247 247 / 65%) 0%, rgb(255 255 255) 54.8481%)'
    }
    // pink
    // ?

    default: {
      return 'linear-gradient(rgb(236 229 255 / 30%) 0%, rgb(255 255 255 / 96%) 100%)'
    }
  }
}

export const holder = 1
