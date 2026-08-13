'use client'

import { COLOR } from '~/const/colors'
import type { TColorName } from '~/spec'

/** Exposes accent color state and actions through the shared React hook boundary. */
export default function useAccentColor(): TColorName {
  return COLOR.CUSTOM
}
