/*
 *
 * NOTE: well, this is not real GraphQL-Fragments, just some comment pice
 * used across the containers / pages, it's enough for now
 *
 * the reason is graphql-request seams not support gql`` tag , which is used
 * by fragment staff, it hurt me so bad
 *
 */

import {
  achievement,
  article,
  articleDetail,
  author,
  c11n,
  comment,
  commentFields,
  commentParent,
  community,
  customLink,
  emotionQuery,
  getUndoUpvote,
  getUpvote,
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
