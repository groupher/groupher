import { loadWallpaperEditor } from '@dash/server/community'
import { createFileRoute, useBlocker } from '@tanstack/react-router'

import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import { wallpaperEditorQueries } from '~/query'
import { getWallpaperThemeSavablePatch } from '~/stores/wallpaper/helper'
import useWallpaperDomain from '~/stores/wallpaper/hooks'
import Wallpaper from '~/unit/DsbThread/Appearance/Wallpaper'

export const Route = createFileRoute('/$community/appearance/wallpaper')({
  loader: async ({ context, params }) => {
    const editorData = await loadWallpaperEditor({ data: { community: params.community } })
    await context.queryClient.ensureQueryData(
      wallpaperEditorQueries.slug(params.community, () => editorData),
    )
  },
  component: AppearanceWallpaperPage,
})

function AppearanceWallpaperPage() {
  const wallpaper = useWallpaperDomain()
  const { isDarkTheme } = useTheme()
  const { t } = useTrans()
  const theme = isDarkTheme ? 'dark' : 'light'
  const isTouched = Object.keys(getWallpaperThemeSavablePatch(wallpaper, theme)).length > 0

  useBlocker({
    enableBeforeUnload: isTouched,
    shouldBlockFn: () => {
      if (!isTouched || typeof window === 'undefined') return false
      // oxlint-disable-next-line no-alert -- Existing unsaved-wallpaper navigation guard.
      return !window.confirm(t('dsb.appearance.wallpaper.unsaved_confirm'))
    },
  })

  return <Wallpaper />
}
