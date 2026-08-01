'use client'

import { useServerInsertedHTML } from 'next/navigation'

import { THEME_FIRST_PAINT_VARS_SCRIPT } from '~/utils/ssr/script'

type TProps = {
  cssText: string
}

export default function CommunityThemePresetStyle({ cssText }: TProps) {
  useServerInsertedHTML(() => {
    if (!cssText) return null

    return (
      <>
        <style
          // oxlint-disable-next-line react/no-danger -- Community theme preset vars must be available before styled content.
          dangerouslySetInnerHTML={{ __html: cssText }}
        />
        <script
          // oxlint-disable-next-line react/no-danger -- Community theme preset vars must be snapshotted before body content is parsed.
          dangerouslySetInnerHTML={{ __html: THEME_FIRST_PAINT_VARS_SCRIPT }}
        />
      </>
    )
  })

  return null
}
