import { THREAD_PATH } from '~/const/thread'
import type { TThread, TThreadPath } from '~/spec'

export const thread2Path = (thread: TThread): TThreadPath => THREAD_PATH[thread]

export const path2Thread = (path: TThreadPath): TThread => {
  const entry = Object.entries(THREAD_PATH).find(([, v]) => v === path)
  return entry?.[0] as TThread
}
