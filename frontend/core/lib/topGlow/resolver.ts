import THEME from '~/const/theme'
import { TOP_GLOW_DARK, TOP_GLOW_KEYS, TOP_GLOW_LIGHT, type TTopGlowName } from '~/const/top_glow'

import type { TTopGlowEffect } from './spec'

/**
 * Resolve a stored `glowType` token into the concrete top-glow preset for the
 * active theme.
 *
 * Intent: callers keep storing only a stable preset key, while this resolver
 * owns invalid-key handling and light/dark preset selection.
 *
 * Example:
 *   const glow = resolveTopGlow(glowType, theme)
 */
export const resolveTopGlow = (
  glowType: string | null | undefined,
  theme: string,
): TTopGlowEffect | null => {
  if (!glowType) return null

  const presets = theme === THEME.LIGHT ? TOP_GLOW_LIGHT : TOP_GLOW_DARK

  if (!(TOP_GLOW_KEYS as readonly string[]).includes(glowType)) return null

  return presets[glowType as TTopGlowName]
}
