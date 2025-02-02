import { P, F } from '~/schemas'

const schema = {
  getUpvote: F.getUpvote,
  getUndoUpvote: F.getUndoUpvote,
  pagedPosts: P.pagedPosts,
}

export default schema
