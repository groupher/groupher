/*
 *
 * NOTE: well, this is not real GraphQL-Fragments, just some comment pices
 * used across the containers / pages, it's enoungh for now
 *
 * the reason is graphql-request semms not support gql`` tag , which is used
 * by fragment staff, it hurt me so bad
 *
 */

import {
  community,
  article,
  articleDetail,
  pageArticleMeta,
  author,
  tag,
  user,
  userSocial,
  c11n,
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
  customLink,
  wallpaper,
  seo,
} from './base'

import { pagedPosts } from './paged'

const F = {
  community,
  article,
  articleDetail,
  pageArticleMeta,
  author,
  customLink,
  wallpaper,
  seo,
  tag,
  pagedPosts,
  user,
  userSocial,
  c11n,
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
