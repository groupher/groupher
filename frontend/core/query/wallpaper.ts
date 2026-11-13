import { queryOptions } from '@tanstack/react-query'

import { parseWallpaper } from '~/lib/ssr/parse'
import type { TParsedWallpaper } from '~/spec'

import { fetchCommunity } from './communitySource'

export const wallpaperKeys = {
  all: ['wallpaper'] as const,
  config: (community: string) => [...wallpaperKeys.all, community] as const,
}

type TWallpaperSeed = () => TParsedWallpaper | Promise<TParsedWallpaper>

const config = (community: string, seed?: TWallpaperSeed) =>
  queryOptions({
    queryKey: wallpaperKeys.config(community),
    queryFn: async (): Promise<TParsedWallpaper> => {
      if (seed) return seed()

      return parseWallpaper(await fetchCommunity(community))
    },
    enabled: !!community,
    staleTime: 60_000,
  })

export const wallpaperQueries = { config }
