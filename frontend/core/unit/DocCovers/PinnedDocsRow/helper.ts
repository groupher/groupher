import { composeBgRenderSpec, type TBgConfig, type TBgRenderSpec } from '~/lib/bg'
import { INITIAL_WALLPAPER_THEME_STATE } from '~/stores/wallpaper/constant'

import type { TPinnedDocAppearance } from '../spec'

export const pinnedDocBackground = (
  appearance: TPinnedDocAppearance | null | undefined,
  dark: boolean,
): TBgRenderSpec | null => {
  const partial = dark ? appearance?.dark : appearance?.light
  if (!partial || (!partial.source && !partial.type)) return null

  const config: TBgConfig = {
    ...INITIAL_WALLPAPER_THEME_STATE,
    ...partial,
    effect: { ...INITIAL_WALLPAPER_THEME_STATE.effect, ...partial.effect },
    pattern: { ...INITIAL_WALLPAPER_THEME_STATE.pattern, ...partial.pattern },
    texture: { ...INITIAL_WALLPAPER_THEME_STATE.texture, ...partial.texture },
  }

  return composeBgRenderSpec(config)
}
