import { loadThemePresets } from '@dash/server/cms'
import { createFileRoute } from '@tanstack/react-router'

import Theme from '~/unit/DashboardThread/Appearance/Theme'

export const Route = createFileRoute('/$community/appearance/theme')({
  staleTime: 60_000,
  loader: () => loadThemePresets({ data: {} }),
  component: ThemePage,
})

function ThemePage() {
  const initialPresetOptions = Route.useLoaderData()

  return <Theme initialPresetOptions={initialPresetOptions} />
}
