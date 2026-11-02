import { activityQueries } from './activity'
import { articleQueries } from './article'
import { commentQueries } from './comment'
import { communityQueries } from './community'
import { dsbQueries } from './dsb'
import { ticketQueries } from './ticket'
import { viewerQueries } from './viewer'
import { wallpaperQueries } from './wallpaper'
import { wallpaperEditorQueries } from './wallpaperEditor'

export const Q = {
  activity: activityQueries,
  article: articleQueries,
  comment: commentQueries,
  community: communityQueries,
  dsb: dsbQueries,
  viewer: viewerQueries,
  wallpaper: wallpaperQueries,
  wallpaperEditor: wallpaperEditorQueries,
  ticket: ticketQueries,
}
