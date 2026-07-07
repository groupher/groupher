import { THREAD, THREAD_PATH } from '~/const/thread'
import type { TThread, TThreadPath } from '~/spec'

const THREAD_BY_PATH = Object.fromEntries(
  Object.entries(THREAD_PATH).map(([thread, path]) => [path, thread]),
) as Record<TThreadPath, TThread>

/**
 * Converts the internal thread key to the public URL path segment.
 */
export const thread2Path = (slug: TThread): TThreadPath => THREAD_PATH[slug]

/**
 * Converts a public URL path segment back to the internal thread key.
 *
 * Unknown paths fall back to posts because post is the default public thread.
 */
export const path2Thread = (path: string): TThread =>
  THREAD_BY_PATH[path as TThreadPath] ?? THREAD.POST
