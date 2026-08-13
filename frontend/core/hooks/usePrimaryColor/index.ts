'use client'

import { COLOR } from '~/const/colors'
import type { TColorName } from '~/spec'

/** Exposes primary color state and actions through the shared React hook boundary. */
export default function usePrimaryColor(): TColorName {
  return COLOR.CUSTOM
}
