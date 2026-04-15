import { THREAD_PATH } from '~/const/thread'
import type { TThread, TThreadPath } from '~/spec'

const THREAD_BY_PATH = Object.fromEntries(
  Object.entries(THREAD_PATH).map(([thread, path]) => [path, thread]),
) as Record<TThreadPath, TThread>

export const thread2Path = (slug: TThread): TThreadPath => THREAD_PATH[slug]
export const path2Thread = (path: TThreadPath): TThread => THREAD_BY_PATH[path]
