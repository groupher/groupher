import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import {
  CreateArticleDocument,
  CreateAndPublishArticleDocument,
  CreateCommentDocument,
  ReplyCommentDocument,
  SaveWorkingCopyDocument,
  SaveDocsQueueCopyDocument,
  UpdateCommentDocument,
} from './generated/graphql'

export type TContentPublishOperation = TypedDocumentNode<Record<string, unknown>, never>

/** Node-safe generated operations used by the trusted Content Publisher adapter. */
export const CONTENT_PUBLISH_OPERATIONS = {
  createArticle: CreateArticleDocument,
  createAndPublishArticle: CreateAndPublishArticleDocument,
  createComment: CreateCommentDocument,
  replyComment: ReplyCommentDocument,
  updateComment: UpdateCommentDocument,
  saveWorkingCopy: SaveWorkingCopyDocument,
  saveDocsQueueCopy: SaveDocsQueueCopyDocument,
} as const
