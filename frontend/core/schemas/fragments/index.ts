/*
 *
 * NOTE: well, this is not real GraphQL-Fragments, just some comment pice
 * used across the containers / pages, it's enough for now
 *
 * the reason is graphql-request seams not support gql`` tag , which is used
 *
 */

import {
  achievement,
  article,
  articleDetail,
  author,
  comment,
  commentFields,
  commentParent,
  community,
  customLink,
  emotionQuery,
  getUndoUpvote,
  getUpvote,
  headerLink,
  footerOnelineLink,
  pageArticleMeta,
  pagi,
  seo,
  tag,
  user,
  userBackgrounds,
  userContributes,
  userSocial,
  wallpaper,
} from './base'
import { pagedPosts } from './paged'

const F = {
  community,
  article,
  articleDetail,
  pageArticleMeta,
  author,
  customLink,
  headerLink,
  footerOnelineLink,
  wallpaper,
  seo,
  tag,
  pagedPosts,
  user,
  userSocial,
  achievement,
  userBackgrounds,
  userContributes,

  comment,
  commentFields,
  emotionQuery,
  commentParent,
  pagi,
  getUpvote,
  getUndoUpvote,
}

export default F
