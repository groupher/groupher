import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import { queryOptions } from '@tanstack/react-query'

import { browserGraphQLRequest } from '~/graphql/client'
import wallpaperDocument from '~/unit/DsbThread/Appearance/Wallpaper/schema'

export type TWallpaperEditorData = ResultOf<typeof wallpaperDocument.wallpaperEditor>

type TWallpaperEditorSeed = () => TWallpaperEditorData | Promise<TWallpaperEditorData>

export const wallpaperEditorKeys = {
  all: ['wallpaper-editor'] as const,
  slug: (community: string) => [...wallpaperEditorKeys.all, community] as const,
}

const fetchWallpaperEditor = (community: string): Promise<TWallpaperEditorData> =>
  browserGraphQLRequest<
    TWallpaperEditorData,
    VariablesOf<typeof wallpaperDocument.wallpaperEditor>
  >(wallpaperDocument.wallpaperEditor, { community })

const slug = (community: string, seed?: TWallpaperEditorSeed) =>
  queryOptions({
    queryKey: wallpaperEditorKeys.slug(community),
    queryFn: async (): Promise<TWallpaperEditorData> =>
      seed ? seed() : fetchWallpaperEditor(community),
    enabled: !!community,
    staleTime: 60_000,
  })

export const wallpaperEditorQueries = { slug }
