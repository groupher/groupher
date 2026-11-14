import { activityQueries } from './activity'
import { articleQueries } from './article'
import { articleActivityQueries } from './articleActivity'
import { commentQueries } from './comment'
import { communityQueries } from './community'
import { dsbQueries } from './dsb'
import { mentionsGraphQueries } from './mentionsGraph'
import { pressQueries } from './press'
import { ticketQueries } from './ticket'
import { viewerQueries } from './viewer'
import { wallpaperQueries } from './wallpaper'
import { wallpaperEditorQueries } from './wallpaperEditor'

export const Q = {
  activity: activityQueries,
  article: articleQueries,
  articleActivity: articleActivityQueries,
  comment: commentQueries,
  community: communityQueries,
  dsb: dsbQueries,
  mentionsGraph: mentionsGraphQueries,
  press: pressQueries,
  viewer: viewerQueries,
  wallpaper: wallpaperQueries,
  wallpaperEditor: wallpaperEditorQueries,
  ticket: ticketQueries,
}
