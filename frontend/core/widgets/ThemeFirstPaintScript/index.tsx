'use client'

import { useServerInsertedHTML } from 'next/navigation'

import { THEME_FIRST_PAINT_VARS_SCRIPT } from '~/utils/ssr/script'

export default function ThemeFirstPaintScript() {
  useServerInsertedHTML(() => (
    <script
      // oxlint-disable-next-line react/no-danger -- First-paint vars must be installed before hydration can reconcile the root theme.
      dangerouslySetInnerHTML={{ __html: THEME_FIRST_PAINT_VARS_SCRIPT }}
    />
  ))

  return null
}
