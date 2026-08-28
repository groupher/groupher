'use client'

import type { FC, ReactNode } from 'react'

import useSalon from '~/shell/GlobalLayout/salon'
import ThemeMonitor from '~/shell/GlobalLayout/ThemeMonitor'
import Wallpaper from '~/shell/GlobalLayout/Wallpaper'
import Toaster from '~/ui/Toaster'

type TProps = {
  children: ReactNode
  mainBlock: FC<{ children: ReactNode }>
}

export default function StaticLayout({ children, mainBlock: Main }: TProps) {
  const s = useSalon()

  return (
    <>
      <div className={s.skeleton}>
        <Wallpaper />
        <div className={s.scrollWrapper}>
          <Main>{children}</Main>
        </div>
      </div>
      <ThemeMonitor />
      <Toaster />
    </>
  )
}
