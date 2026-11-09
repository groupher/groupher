import type { MentionsGraphFocus } from '~/query/mentionsGraph'

import { loadRestrictedResource } from '../server/restrictedResource'

export type RestrictedResourceNode = NonNullable<Awaited<ReturnType<typeof loadRestrictedResource>>>

const stableArticleId = (value: string | null | undefined): boolean =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

async function restrictedNode(
  community: string,
  focus: MentionsGraphFocus,
): Promise<RestrictedResourceNode | null> {
  const stableId = focus.articleInnerId
  const graphFocus =
    typeof stableId === 'string' && stableArticleId(stableId)
      ? { type: focus.type, articleId: stableId }
      : focus
  return loadRestrictedResource({ data: { community, focus: graphFocus } })
}

/** Shows resource status when the public detail is unavailable. */
export async function loadResourceWithStatus<T>(
  load: () => Promise<T | null | undefined>,
  community: string,
  focus: MentionsGraphFocus,
): Promise<{ resource: T | null; restricted: RestrictedResourceNode | null }> {
  try {
    const resource = await load()
    if (resource) return { resource, restricted: null }
  } catch (error) {
    const restricted = await restrictedNode(community, focus).catch(() => null)
    if (restricted) return { resource: null, restricted }
    throw error
  }

  return { resource: null, restricted: await restrictedNode(community, focus).catch(() => null) }
}
