import persist from '~/lib/persist'

import type { TWallpaperPatch } from './spec'

const demoWallpaperKey = (community: string): string => `wallpaper:demo:${community}`

/** Reads locally saved wallpaper fields for one Dash Demo community. */
export const readDemoWallpaper = (community: string): TWallpaperPatch =>
  persist.get<TWallpaperPatch>(demoWallpaperKey(community), {}) ?? {}

/** Saves only the submitted wallpaper fields for one Dash Demo community. */
export const writeDemoWallpaper = (community: string, patch: TWallpaperPatch): void => {
  const current = readDemoWallpaper(community)
  const next: TWallpaperPatch = { ...current }

  for (const theme of ['light', 'dark'] as const) {
    const submitted = patch[theme]
    if (submitted) next[theme] = { ...current[theme], ...submitted }
  }

  persist.set(demoWallpaperKey(community), next)
}
