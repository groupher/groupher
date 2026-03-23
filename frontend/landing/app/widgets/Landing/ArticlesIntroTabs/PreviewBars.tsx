import type { FC } from 'react'
import { THREAD } from '~/const/thread'
import type { TThread } from '~/spec'

import useSalon, { cn } from '../salon/articles_intro_tabs/preview_bars'

type TProps = {
  tab: TThread
  color: string
}

const PreviewBars: FC<TProps> = ({ tab, color }) => {
  const s = useSalon()

  switch (tab) {
    case THREAD.KANBAN: {
      return (
        <>
          <div className={cn(s.bar, s[`${color}Bg`], 'top-1 w-3 opacity-20 h-0.5')} />
          <div className={cn(s.bar, s[`${color}Bg`], 'top-2.5 w-3 h-6 opacity-20 rounded')} />

          <div className={cn(s.bar, s[`${color}Bg`], 'top-1 w-3 opacity-20 h-0.5 left-5')} />
          <div
            className={cn(s.bar, s[`${color}Bg`], 'top-2.5 w-3 h-6 opacity-20 rounded left-5')}
          />
        </>
      )
    }

    case THREAD.CHANGELOG: {
      return (
        <>
          <div className={cn(s.bar, s[`${color}Bg`], 'top-1 opacity-20')} />
          <div className={cn(s.bar, s[`${color}Bg`], 'top-3 w-7 h-4 rounded')} />
          <div className={cn(s.bar, s[`${color}Bg`], 'bottom-0.5 mb-0.5 h-0.5')} />
        </>
      )
    }

    case THREAD.DOC: {
      return (
        <>
          <div
            className={cn(
              s.bar,
              s[`${color}Bg`],
              'top-1.5 left-3.5 ml-0.5 h-7 w-4 rounded-sm opacity-20',
            )}
          />

          <div className={cn(s.bar, s[`${color}Bg`], 'top-2 left-1 h-0.5 opacity-20 w-2')} />
          <div className={cn(s.bar, s[`${color}Bg`], 'top-3.5 left-1 h-0.5 opacity-30 w-2')} />
          <div className={cn(s.bar, s[`${color}Bg`], 'top-5 left-1 h-0.5 opacity-15 w-2')} />
          <div className={cn(s.bar, s[`${color}Bg`], 'top-6 left-1 mt-px h-0.5 opacity-30 w-2')} />
          <div className={cn(s.bar, s[`${color}Bg`], 'top-7 left-1 mt-0.5 h-0.5 opacity-15 w-2')} />
        </>
      )
    }

    default: {
      return (
        <>
          <div className={cn(s.bar, s[`${color}Bg`], 'top-1')} />
          <div className={cn(s.bar, s[`${color}Bg`], 'top-3 w-7')} />
          <div className={cn(s.bar, s[`${color}Bg`], 'top-5 w-3.5')} />
          <div className={cn(s.bar, s[`${color}Bg`], 'top-7 w-2.5')} />
        </>
      )
    }
  }
}

export default PreviewBars
