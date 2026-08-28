import { createFileRoute } from '@tanstack/react-router'

import Wallpaper from '~/unit/DsbThread/Appearance/Wallpaper'

export const Route = createFileRoute('/$community/appearance/wallpaper')({
  component: AppearanceWallpaperPage,
})

function AppearanceWallpaperPage() {
  return <Wallpaper />
}
