'use client'

import { useServerInsertedHTML } from 'next/navigation'

type TProps = {
  cssText: string
}

export default function CommunityThemePresetStyle({ cssText }: TProps) {
  useServerInsertedHTML(() => {
    if (!cssText) return null

    return (
      <style
        // oxlint-disable-next-line react/no-danger -- Community theme preset vars must be available before styled content.
        dangerouslySetInnerHTML={{ __html: cssText }}
      />
    )
  })

  return null
}
