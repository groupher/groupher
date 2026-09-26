const TAG_PATTERN = /^community\[[A-Za-z0-9][A-Za-z0-9-]*\](?:-[A-Za-z0-9\x5b\x5d-]+)?$/

const text = (value: string | number): string => String(value)

export const publicCacheTags = {
  community: (community: string): string => `community[${community}]`,
  articleList: (community: string, thread: string): string =>
    `community[${community}]-thread[${thread}]-articles`,
  articleDetail: (community: string, thread: string, innerId: string | number): string =>
    `community[${community}]-thread[${thread}]-article[${text(innerId)}]`,
  comments: (community: string, thread: string, innerId: string | number): string =>
    `community[${community}]-thread[${thread}]-article[${text(innerId)}]-comments`,
  tags: (community: string, thread: string): string =>
    `community[${community}]-thread[${thread}]-tags`,
  docTree: (community: string): string => `community[${community}]-doc-tree`,
} as const

/** Validates a tag against the shared public-cache wire protocol. */
export const isPublicCacheTag = (value: unknown): value is string =>
  typeof value === 'string' && TAG_PATTERN.test(value)
