import persist from '~/lib/persist'
import { articleQueryKeys } from '~/query/key'
import type { TTagGroup, TThread } from '~/spec'

const demoTagGroupsKey = (community: string, thread: TThread): string =>
  `tags:demo:${community}:${thread}`

/** Returns the isolated Query key used for a community's local Tags Demo. */
export const demoTagGroupsQueryKey = (community: string, thread: TThread) =>
  [...articleQueryKeys.tagGroups(community, thread), 'demo'] as const

/** Reads locally saved tag groups for one community and thread. */
export const readDemoTagGroups = (community: string, thread: TThread): TTagGroup[] | undefined =>
  persist.get<TTagGroup[] | null>(demoTagGroupsKey(community, thread), null) ?? undefined

/** Saves the current local tag groups for one community and thread. */
export const writeDemoTagGroups = (
  community: string,
  thread: TThread,
  groups: readonly TTagGroup[],
): void => {
  persist.set(demoTagGroupsKey(community, thread), groups)
}
