import { WALLPAPER_TYPE } from '~/const/wallpaper'
import { adaptWallpaperBgRenderSpec } from '~/hooks/useWallpaper'
import type { TBgRenderSpec } from '~/lib/bg'
import { encodeWallpaperSettings } from '~/lib/wallpaperSettingsCodec'
import type { TWallpaperSettingsInput } from '~/lib/wallpaperSettingsCodec'
import type { TImageExportTarget } from '~/render/ImageExport'
import { wallpaperExportTargets } from '~/render/WallpaperExport'
import type { TWallpaperThemeState } from '~/stores/wallpaper/spec'

export type TWallpaperPublishPlan =
  | {
      type: 'none'
      community: string
      theme: 'light' | 'dark'
      baseVersion: number
      settings: TWallpaperSettingsInput
      commandId?: string
    }
  | {
      type: 'generated'
      community: string
      theme: 'light' | 'dark'
      baseVersion: number
      settings: TWallpaperSettingsInput
      commandId?: string
      renderSpec: TBgRenderSpec
      targets: readonly TImageExportTarget[]
    }

type TBuildWallpaperPublishPlanInput = {
  community: string
  theme: 'light' | 'dark'
  baseVersion: number
  wallpaper: TWallpaperThemeState
  /** Reuse the coordinator-selected key when retrying the same fingerprint. */
  reuseCommandId?: string
}

/** Builds the immutable input shared by Wallpaper export and publish steps. */
export const buildWallpaperPublishPlan = ({
  community,
  theme,
  baseVersion,
  wallpaper,
  reuseCommandId,
}: TBuildWallpaperPublishPlanInput): TWallpaperPublishPlan => {
  const settings = encodeWallpaperSettings(wallpaper)
  const key = reuseCommandId ? { commandId: reuseCommandId } : {}

  if (wallpaper.type === WALLPAPER_TYPE.NONE) {
    return { baseVersion, community, settings, theme, type: 'none', ...key }
  }

  return {
    baseVersion,
    community,
    ...key,
    renderSpec: adaptWallpaperBgRenderSpec(wallpaper),
    settings,
    targets: wallpaperExportTargets(),
    theme,
    type: 'generated',
  }
}
