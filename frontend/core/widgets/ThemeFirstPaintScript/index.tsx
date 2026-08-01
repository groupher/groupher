'use client'

import { useServerInsertedHTML } from 'next/navigation'
import { useEffect } from 'react'

import { THEME_FIRST_PAINT_VARS_SCRIPT } from '~/utils/ssr/script'
import { scheduleRemoveThemeFirstPaintVars } from '~/utils/themeFirstPaint'

export default function ThemeFirstPaintScript() {
  useServerInsertedHTML(() => (
    <script
      // oxlint-disable-next-line react/no-danger -- First-paint vars must be installed before hydration can reconcile the root theme.
      dangerouslySetInnerHTML={{ __html: THEME_FIRST_PAINT_VARS_SCRIPT }}
    />
  ))

  useEffect(() => scheduleRemoveThemeFirstPaintVars(), [])

  return null
}
