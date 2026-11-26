import { GraphQLError } from 'graphql'

/** Builds deterministic canonical Pages for mock data; cursors are test-only positions. */
export const mockPage = (entries, pagi, scope) => {
  const cursorMode = !!pagi?.cursor
  const size = (cursorMode ? pagi.cursor.first : pagi?.offset?.size) ?? 20
  const page = pagi?.offset?.page ?? 1
  const prefix = `mock:${scope}:`
  let after = pagi?.cursor?.after
  if (after && /^[A-Za-z0-9_-]+$/.test(after)) {
    try {
      after = JSON.parse(Buffer.from(after, 'base64url').toString()).payload.cursor
    } catch {}
  }
  if (after && (!after.startsWith(prefix) || !/^\d+$/.test(after.slice(prefix.length)))) {
    throw new GraphQLError('Mock cursor query mismatch')
  }
  const start = cursorMode ? Number(after?.slice(prefix.length) ?? 0) : (page - 1) * size
  if (!Number.isInteger(size) || size < 1 || size > 100 || !Number.isInteger(start) || start < 0) {
    throw new GraphQLError('Invalid mock pagination position')
  }
  const slice = entries.slice(start, start + size)
  const bounds = { hasNextPage: start + size < entries.length, hasPreviousPage: start > 0 }
  return {
    entries: slice,
    pageInfo: cursorMode
      ? {
          __typename: 'CursorPageInfo',
          ...bounds,
          startCursor: slice.length
            ? Buffer.from(
                JSON.stringify({
                  cursor_version: 1,
                  key_version: 1,
                  payload: {
                    cursor: `${prefix}${start}`,
                    surface: scope,
                    order: {},
                    fingerprint: scope,
                  },
                  signature: 'mock',
                }),
              ).toString('base64url')
            : null,
          endCursor: slice.length
            ? Buffer.from(
                JSON.stringify({
                  cursor_version: 1,
                  key_version: 1,
                  payload: {
                    cursor: `${prefix}${start + slice.length}`,
                    surface: scope,
                    order: {},
                    fingerprint: scope,
                  },
                  signature: 'mock',
                }),
              ).toString('base64url')
            : null,
        }
      : {
          __typename: 'OffsetPageInfo',
          ...bounds,
          page,
          size,
          totalCount: entries.length,
          totalPages: Math.ceil(entries.length / size),
        },
  }
}
