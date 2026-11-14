import { queryOptions } from '@tanstack/react-query'

import { parseWallpaper } from '~/lib/ssr/parse'
import type { TParsedWallpaper } from '~/spec'

import { fetchCommunity } from './communitySource'

export const wallpaperKeys = {
  all: ['wallpaper'] as const,
  slug: (community: string) => [...wallpaperKeys.all, community] as const,
}

export const wallpaperMutationKeys = {
  publish: (community: string) => [...wallpaperKeys.all, community, 'publish'] as const,
}

type TWallpaperSeed = () => TParsedWallpaper | Promise<TParsedWallpaper>

const slug = (community: string, seed?: TWallpaperSeed) =>
  queryOptions({
    queryKey: wallpaperKeys.slug(community),
    queryFn: async (): Promise<TParsedWallpaper> => {
      if (seed) return seed()

      return parseWallpaper(await fetchCommunity(community))
    },
    enabled: !!community,
    meta: { hydration: 'public' },
    staleTime: 60_000,
  })

export const wallpaperQueries = { slug }
