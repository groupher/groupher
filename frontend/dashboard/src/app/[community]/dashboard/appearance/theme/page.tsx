import { getThemePresets } from '~/app/ssr'
import Theme from '~/unit/DashboardThread/Appearance/Theme'

export default async function Page() {
  const themePresets = await getThemePresets()

  return <Theme initialPresetOptions={themePresets} />
}
