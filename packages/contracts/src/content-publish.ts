export { CONTENT_PUBLISH_ERROR_CODE } from './content-publish.generated'
export type { TContentPublishErrorCode } from './content-publish.generated'

export const CONTENT_SOURCE_FORMAT = { PLATE: 'plate', MARKDOWN: 'markdown' } as const

export const CONTENT_PUBLISH_ACTION = {
  UPDATE_DOC_DRAFT: 'docDraft.update',
  CREATE_ARTICLE: 'article.create',
  SAVE_WORKING_COPY: 'article.working_copy.save',
  CREATE_AND_PUBLISH_ARTICLE: 'article.create_and_publish',
  CREATE_COMMENT: 'comment.create',
  UPDATE_COMMENT: 'comment.update',
} as const

export const CONTENT_TYPE = { DOC: 'doc', ARTICLE: 'article', COMMENT: 'comment' } as const
export const CONTENT_ARTICLE_THREAD = {
  POST: 'post',
  BLOG: 'blog',
  CHANGELOG: 'changelog',
} as const
export const CONTENT_PUBLISH_SCOPE = {
  DOC_WRITE: 'content:doc:write',
  ARTICLE_WRITE: 'content:article:write',
  COMMENT_WRITE: 'content:comment:write',
} as const
export const CONTENT_PUBLISH_AUDIENCE = 'phoenix:content-publisher-api'
export const CONTENT_PUBLISH_RESOURCE = 'https://api.groupher.com/content-publisher'

export type TContentPublishAction =
  (typeof CONTENT_PUBLISH_ACTION)[keyof typeof CONTENT_PUBLISH_ACTION]
export type TContentType = (typeof CONTENT_TYPE)[keyof typeof CONTENT_TYPE]
export type TContentArticleThread =
  (typeof CONTENT_ARTICLE_THREAD)[keyof typeof CONTENT_ARTICLE_THREAD]
export type TContentPublishScope =
  (typeof CONTENT_PUBLISH_SCOPE)[keyof typeof CONTENT_PUBLISH_SCOPE]
export type TContentSource =
  | { format: typeof CONTENT_SOURCE_FORMAT.PLATE; value: unknown[] }
  | { format: typeof CONTENT_SOURCE_FORMAT.MARKDOWN; markdown: string }

export type TArticleContentFields = {
  copyRight?: string
  linkAddr?: string
  subtitle?: string
  templateKey?: string
  coverUrl?: string
  coverUrlDark?: string
}

type TCommandBase<TAction extends TContentPublishAction, TTarget, TPayload> = {
  action: TAction
  target: TTarget
  payload: TPayload
  commandId: string
}

export type TUpdateDocDraftCommand = TCommandBase<
  typeof CONTENT_PUBLISH_ACTION.UPDATE_DOC_DRAFT,
  { community: string; documentId: string },
  { content: TContentSource; title: string; subtitle: string; slug: string }
> & { expectedVersion: number }
export type TCreateArticleCommand = TCommandBase<
  typeof CONTENT_PUBLISH_ACTION.CREATE_ARTICLE,
  { community: string; thread: TContentArticleThread },
  {
    content: TContentSource
    title?: string
    digest?: string
    slug?: string
    tagIds: string[]
  } & TArticleContentFields
>
export type TCreateAndPublishArticleCommand = TCommandBase<
  typeof CONTENT_PUBLISH_ACTION.CREATE_AND_PUBLISH_ARTICLE,
  { community: string; thread: TContentArticleThread },
  {
    content: TContentSource
    title: string
    digest?: string
    slug?: string
    tagIds: string[]
  } & TArticleContentFields
>
export type TSaveWorkingCopyCommand = TCommandBase<
  typeof CONTENT_PUBLISH_ACTION.SAVE_WORKING_COPY,
  { community: string; articleId: string; workingCopyId: string },
  {
    content: TContentSource
    title?: string
    digest?: string
    slug?: string
    tagIds?: string[]
  } & TArticleContentFields
> & { revision: number }
export type TCreateCommentCommand = TCommandBase<
  typeof CONTENT_PUBLISH_ACTION.CREATE_COMMENT,
  {
    article: { community: string; thread: string; innerId: string | number }
    parentId?: string
  },
  { content: TContentSource }
>
export type TUpdateCommentCommand = TCommandBase<
  typeof CONTENT_PUBLISH_ACTION.UPDATE_COMMENT,
  {
    comment: {
      article: { community: string; thread: string; innerId: string | number }
      innerId: string
    }
  },
  { content: TContentSource }
> & { expectedVersion: number }
export type TContentPublishCommand =
  | TUpdateDocDraftCommand
  | TCreateArticleCommand
  | TCreateAndPublishArticleCommand
  | TSaveWorkingCopyCommand
  | TCreateCommentCommand
  | TUpdateCommentCommand

export const CONTENT_TYPE_BY_ACTION = {
  [CONTENT_PUBLISH_ACTION.UPDATE_DOC_DRAFT]: CONTENT_TYPE.DOC,
  [CONTENT_PUBLISH_ACTION.CREATE_ARTICLE]: CONTENT_TYPE.ARTICLE,
  [CONTENT_PUBLISH_ACTION.SAVE_WORKING_COPY]: CONTENT_TYPE.ARTICLE,
  [CONTENT_PUBLISH_ACTION.CREATE_AND_PUBLISH_ARTICLE]: CONTENT_TYPE.ARTICLE,
  [CONTENT_PUBLISH_ACTION.CREATE_COMMENT]: CONTENT_TYPE.COMMENT,
  [CONTENT_PUBLISH_ACTION.UPDATE_COMMENT]: CONTENT_TYPE.COMMENT,
} as const satisfies Record<TContentPublishAction, TContentType>

export const CONTENT_SCOPE_BY_ACTION = {
  [CONTENT_PUBLISH_ACTION.UPDATE_DOC_DRAFT]: CONTENT_PUBLISH_SCOPE.DOC_WRITE,
  [CONTENT_PUBLISH_ACTION.CREATE_ARTICLE]: CONTENT_PUBLISH_SCOPE.ARTICLE_WRITE,
  [CONTENT_PUBLISH_ACTION.SAVE_WORKING_COPY]: CONTENT_PUBLISH_SCOPE.ARTICLE_WRITE,
  [CONTENT_PUBLISH_ACTION.CREATE_AND_PUBLISH_ARTICLE]: CONTENT_PUBLISH_SCOPE.ARTICLE_WRITE,
  [CONTENT_PUBLISH_ACTION.CREATE_COMMENT]: CONTENT_PUBLISH_SCOPE.COMMENT_WRITE,
  [CONTENT_PUBLISH_ACTION.UPDATE_COMMENT]: CONTENT_PUBLISH_SCOPE.COMMENT_WRITE,
} as const satisfies Record<TContentPublishAction, TContentPublishScope>

export type TContentPublishIssue = { path: string; code: string; message: string }
type TContentPublishParseFailure = { ok: false; issues: TContentPublishIssue[] }
export type TContentPublishParseResult =
  | { ok: true; value: TContentPublishCommand }
  | TContentPublishParseFailure
const issue = (path: string, code: string, message: string): TContentPublishParseFailure => ({
  ok: false,
  issues: [{ path, code, message }],
})
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const isContentArticleThread = (thread: string): thread is TContentArticleThread =>
  Object.values(CONTENT_ARTICLE_THREAD).includes(thread as TContentArticleThread)
const failed = (value: unknown): value is TContentPublishParseFailure =>
  isRecord(value) && value.ok === false
const readString = (
  record: Record<string, unknown>,
  key: string,
  path = key,
): string | TContentPublishParseFailure =>
  typeof record[key] === 'string' && record[key].trim()
    ? (record[key] as string)
    : issue(path, 'invalid_string', `${key} must be a non-empty string.`)
const readRevision = (record: Record<string, unknown>): number | TContentPublishParseFailure => {
  if ('expectedVersion' in record)
    return issue('expectedVersion', 'unsupported_field', 'Use revision for WorkingCopy saves.')
  return Number.isSafeInteger(record.revision) && Number(record.revision) > 0
    ? Number(record.revision)
    : issue('revision', 'invalid_revision', 'revision must be a positive integer.')
}
const readExpectedVersion = (
  record: Record<string, unknown>,
): number | TContentPublishParseFailure =>
  Number.isSafeInteger(record.expectedVersion) && Number(record.expectedVersion) > 0
    ? Number(record.expectedVersion)
    : issue('expectedVersion', 'invalid_version', 'expectedVersion must be a positive integer.')
const readPatchString = (
  record: Record<string, unknown>,
  key: string,
): string | undefined | TContentPublishParseFailure => {
  if (!(key in record)) return undefined
  return typeof record[key] === 'string'
    ? (record[key] as string)
    : issue(`payload.${key}`, 'invalid_string', `${key} must be a string when provided.`)
}
const parseArticleContentFields = (
  payload: Record<string, unknown>,
): TArticleContentFields | TContentPublishParseFailure => {
  const fieldNames = [
    'copyRight',
    'linkAddr',
    'subtitle',
    'templateKey',
    'coverUrl',
    'coverUrlDark',
  ] as const
  const fields: TArticleContentFields = {}
  for (const key of fieldNames) {
    const value = readPatchString(payload, key)
    if (failed(value)) return value
    if (value !== undefined) fields[key] = value
  }
  return fields
}
const parseSource = (value: unknown): TContentSource | TContentPublishParseFailure => {
  if (!isRecord(value))
    return issue('payload.content', 'invalid_type', 'Content source must be an object.')
  if (value.format === CONTENT_SOURCE_FORMAT.PLATE)
    return Array.isArray(value.value)
      ? { format: CONTENT_SOURCE_FORMAT.PLATE, value: value.value }
      : issue('payload.content.value', 'invalid_type', 'Plate content must be an array.')
  if (value.format === CONTENT_SOURCE_FORMAT.MARKDOWN)
    return typeof value.markdown === 'string'
      ? { format: CONTENT_SOURCE_FORMAT.MARKDOWN, markdown: value.markdown }
      : issue('payload.content.markdown', 'invalid_type', 'Markdown content must be a string.')
  return issue(
    'payload.content.format',
    'unknown_format',
    'Content source format is not supported.',
  )
}

/** Parses untrusted JSON into one closed, action-specific command. */
export const parseContentPublishCommand = (input: unknown): TContentPublishParseResult => {
  if (!isRecord(input)) return issue('', 'invalid_type', 'Request body must be an object.')
  const action = input.action
  if (!Object.values(CONTENT_PUBLISH_ACTION).includes(action as TContentPublishAction))
    return issue('action', 'unknown_action', 'Content publish action is not supported.')
  if (!isRecord(input.target)) return issue('target', 'invalid_type', 'target must be an object.')
  if (!isRecord(input.payload))
    return issue('payload', 'invalid_type', 'payload must be an object.')
  const commandId = readString(input, 'commandId')
  if (failed(commandId)) return commandId
  const content = parseSource(input.payload.content)
  if (failed(content)) return content
  const target = input.target
  const payload = input.payload
  switch (action) {
    case CONTENT_PUBLISH_ACTION.CREATE_ARTICLE: {
      const community = readString(target, 'community', 'target.community')
      if (failed(community)) return community
      const thread = readString(target, 'thread', 'target.thread')
      if (failed(thread)) return thread
      if (!isContentArticleThread(thread))
        return issue(
          'target.thread',
          'unsupported_thread',
          'Article creation does not support Doc.',
        )
      const title = readPatchString(payload, 'title')
      if (failed(title)) return title
      const digest = readPatchString(payload, 'digest')
      if (failed(digest)) return digest
      const slug = readPatchString(payload, 'slug')
      if (failed(slug)) return slug
      const articleFields = parseArticleContentFields(payload)
      if (failed(articleFields)) return articleFields
      const tagIds = payload.tagIds === undefined ? [] : payload.tagIds
      if (!Array.isArray(tagIds) || !tagIds.every((id) => typeof id === 'string'))
        return issue('payload.tagIds', 'invalid_type', 'tagIds must be an array of strings.')
      return {
        ok: true,
        value: {
          action,
          target: { community, thread },
          payload: {
            content,
            ...(title === undefined ? {} : { title }),
            ...(digest === undefined ? {} : { digest }),
            ...(slug === undefined ? {} : { slug }),
            tagIds,
            ...articleFields,
          },
          commandId,
        },
      }
    }
    case CONTENT_PUBLISH_ACTION.SAVE_WORKING_COPY: {
      const community = readString(target, 'community', 'target.community')
      if (failed(community)) return community
      const articleId = readString(target, 'articleId', 'target.articleId')
      if (failed(articleId)) return articleId
      const workingCopyId = readString(target, 'workingCopyId', 'target.workingCopyId')
      if (failed(workingCopyId)) return workingCopyId
      const title = readPatchString(payload, 'title')
      if (failed(title)) return title
      const digest = readPatchString(payload, 'digest')
      if (failed(digest)) return digest
      const slug = readPatchString(payload, 'slug')
      if (failed(slug)) return slug
      const articleFields = parseArticleContentFields(payload)
      if (failed(articleFields)) return articleFields
      const revision = readRevision(input)
      if (failed(revision)) return revision
      if (
        payload.tagIds !== undefined &&
        (!Array.isArray(payload.tagIds) || !payload.tagIds.every((id) => typeof id === 'string'))
      )
        return issue('payload.tagIds', 'invalid_type', 'tagIds must be an array of strings.')
      return {
        ok: true,
        value: {
          action,
          target: { community, articleId, workingCopyId },
          payload: {
            content,
            ...(title === undefined ? {} : { title }),
            ...(digest === undefined ? {} : { digest }),
            ...(slug === undefined ? {} : { slug }),
            ...(payload.tagIds === undefined ? {} : { tagIds: payload.tagIds as string[] }),
            ...articleFields,
          },
          commandId,
          revision,
        },
      }
    }
    case CONTENT_PUBLISH_ACTION.UPDATE_DOC_DRAFT: {
      const community = readString(target, 'community', 'target.community')
      if (failed(community)) return community
      const documentId = readString(target, 'documentId', 'target.documentId')
      if (failed(documentId)) return documentId
      const title = readString(payload, 'title', 'payload.title')
      if (failed(title)) return title
      if (typeof payload.subtitle !== 'string')
        return issue('payload.subtitle', 'invalid_string', 'subtitle must be a string.')
      const slug = readString(payload, 'slug', 'payload.slug')
      if (failed(slug)) return slug
      const expectedVersion = readExpectedVersion(input)
      if (failed(expectedVersion)) return expectedVersion
      return {
        ok: true,
        value: {
          action,
          target: { community, documentId },
          payload: { content, title, subtitle: payload.subtitle, slug },
          commandId,
          expectedVersion,
        },
      }
    }
    case CONTENT_PUBLISH_ACTION.CREATE_AND_PUBLISH_ARTICLE: {
      const community = readString(target, 'community', 'target.community')
      if (failed(community)) return community
      const thread = readString(target, 'thread', 'target.thread')
      if (failed(thread)) return thread
      if (!isContentArticleThread(thread))
        return issue(
          'target.thread',
          'unsupported_thread',
          'Article creation does not support Doc.',
        )
      const title = readString(payload, 'title', 'payload.title')
      if (failed(title)) return title
      const digest = readPatchString(payload, 'digest')
      if (failed(digest)) return digest
      const slug = readPatchString(payload, 'slug')
      if (failed(slug)) return slug
      if (!Array.isArray(payload.tagIds) || !payload.tagIds.every((id) => typeof id === 'string'))
        return issue('payload.tagIds', 'invalid_type', 'tagIds must be an array of strings.')
      return {
        ok: true,
        value: {
          action,
          target: { community, thread },
          payload: {
            content,
            title,
            ...(digest === undefined ? {} : { digest }),
            ...(slug === undefined ? {} : { slug }),
            tagIds: payload.tagIds,
          },
          commandId,
        },
      }
    }
    case CONTENT_PUBLISH_ACTION.CREATE_COMMENT: {
      if (!isRecord(target.article))
        return issue('target.article', 'invalid_type', 'article must be an object.')
      const community = readString(target.article, 'community', 'target.article.community')
      if (failed(community)) return community
      const thread = readString(target.article, 'thread', 'target.article.thread')
      if (failed(thread)) return thread
      const innerId = target.article.innerId
      if (typeof innerId !== 'string' && typeof innerId !== 'number')
        return issue(
          'target.article.innerId',
          'invalid_type',
          'innerId must be a string or number.',
        )
      return {
        ok: true,
        value: {
          action,
          target: {
            article: { community, thread, innerId },
            ...(typeof target.parentId === 'string' ? { parentId: target.parentId } : {}),
          },
          payload: { content },
          commandId,
        },
      }
    }
    case CONTENT_PUBLISH_ACTION.UPDATE_COMMENT: {
      if (!isRecord(target.comment) || !isRecord(target.comment.article))
        return issue('target.comment', 'invalid_type', 'comment must be an object.')
      const community = readString(
        target.comment.article,
        'community',
        'target.comment.article.community',
      )
      if (failed(community)) return community
      const thread = readString(target.comment.article, 'thread', 'target.comment.article.thread')
      if (failed(thread)) return thread
      const articleInnerId = target.comment.article.innerId
      if (typeof articleInnerId !== 'string' && typeof articleInnerId !== 'number')
        return issue(
          'target.comment.article.innerId',
          'invalid_type',
          'innerId must be a string or number.',
        )
      const innerId = readString(target.comment, 'innerId', 'target.comment.innerId')
      if (failed(innerId)) return innerId
      const expectedVersion = readExpectedVersion(input)
      if (failed(expectedVersion)) return expectedVersion
      return {
        ok: true,
        value: {
          action,
          target: {
            comment: {
              article: { community, thread, innerId: articleInnerId },
              innerId,
            },
          },
          payload: { content },
          commandId,
          expectedVersion,
        },
      }
    }
  }
  return issue('action', 'unknown_action', 'Content publish action is not supported.')
}
