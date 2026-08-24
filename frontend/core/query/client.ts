import { activityQueries } from './activity'
import { articleQueries } from './article'
import { commentQueries } from './comment'
import { viewerQueries } from './viewer'

export const Q = {
  activity: activityQueries,
  article: articleQueries,
  comment: commentQueries,
  viewer: viewerQueries,
}
