import { communityKeys } from '../community'
import { dsbKeys } from '../dsb'
import { wallpaperKeys } from '../wallpaper'
import { wallpaperEditorKeys } from '../wallpaperEditor'
import type { TQueryInvalidationPlan, TQueryInvalidationTarget } from './types'

const exact = (key: readonly unknown[]) => (queryKey: readonly unknown[]) =>
  key.length === queryKey.length && key.every((part, index) => queryKey[index] === part)

/** Invalidates the public community configuration query. */
export const config = (community: string): TQueryInvalidationTarget => ({
  domain: 'community',
  target: 'config',
  community,
})

/** Invalidates the dashboard configuration query for a community. */
export const dashboard = (community: string): TQueryInvalidationTarget => ({
  domain: 'community',
  target: 'dashboard',
  community,
})

/** Invalidates the public wallpaper query for a community. */
export const wallpaper = (community: string): TQueryInvalidationTarget => ({
  domain: 'community',
  target: 'wallpaper',
  community,
})

/** Invalidates the wallpaper-editor query for a community. */
export const wallpaperEditor = (community: string): TQueryInvalidationTarget => ({
  domain: 'community',
  target: 'wallpaper-editor',
  community,
})

/** Invalidates the press configuration query for a community. */
export const pressConfig = (community: string): TQueryInvalidationTarget => ({
  domain: 'community',
  target: 'press-config',
  community,
})

/** Resolves a community invalidation target into query-key matchers. */
export const resolve = (target: TQueryInvalidationTarget): TQueryInvalidationPlan => {
  if (target.domain !== 'community') return { matches: [], refetch: 'active' }

  const key =
    target.target === 'config'
      ? communityKeys.config(target.community)
      : target.target === 'dashboard'
        ? dsbKeys.config(target.community)
        : target.target === 'wallpaper'
          ? wallpaperKeys.config(target.community)
          : target.target === 'wallpaper-editor'
            ? wallpaperEditorKeys.config(target.community)
            : communityKeys.pressConfig(target.community)

  return {
    matches: [{ domain: target.domain, target: target.target, matches: exact(key) }],
    refetch: 'active',
  }
}
