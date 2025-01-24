import type { FC } from 'react'

import type { TDocLayout } from '~/spec'
import { DOC_LAYOUT } from '~/const/layout'

import ToolSVG from '~/icons/Book'

import useSalon, { cn } from '../../salon/layout/doc_layout/main_template'

type TProps = {
  layout: TDocLayout
}

const MainTemplate: FC<TProps> = ({ layout }) => {
  const s = useSalon()

  if (layout === DOC_LAYOUT.CARDS) {
    return (
      <div className={cn(s.block, 'gap-x-3 gap-y-1 w-full')}>
        <div className={s.borderBox}>
          <div className={cn(s.bar, 'h-1 top-2 left-1 w-6 opacity-20')} />
          <div className={cn(s.bar, 'h-1.5 top-4 left-1 w-10 opacity-40')} />

          <div className={cn(s.bar, 'h-1 top-8 left-1 w-12 opacity-20')} />
          <div className={cn(s.bar, 'h-1 top-10 left-1 w-16 opacity-15')} />
          <div className={cn(s.bar, 'h-1 top-12 left-1 w-10 opacity-10')} />

          <div className={cn(s.bar, 'h-3 bottom-1 left-1.5 w-10/12 opacity-10')} />
          <div className={cn(s.bar, 'h-1 bottom-2 left-5 w-8 opacity-30')} />
        </div>

        <div className={s.borderBox}>
          <div className={cn(s.bar, 'h-1 top-2 left-1 w-6 opacity-20')} />
          <div className={cn(s.bar, 'h-1.5 top-4 left-1 w-8 opacity-40')} />

          <div className={cn(s.bar, 'h-1 top-8 left-1 w-10 opacity-20')} />
          <div className={cn(s.bar, 'h-1 top-10 left-1 w-8 opacity-15')} />
          <div className={cn(s.bar, 'h-1 top-12 left-1 w-8 opacity-10')} />

          <div className={cn(s.bar, 'h-3 bottom-1 left-1.5 w-10/12 opacity-10')} />
          <div className={cn(s.bar, 'h-1 bottom-2 left-5 w-8 opacity-30')} />
        </div>

        <div className={s.borderBox}>
          <div className={cn(s.bar, 'h-1 top-2 left-1 w-6 opacity-20')} />
          <div className={cn(s.bar, 'h-1.5 top-4 left-1 w-8 opacity-40')} />

          <div className={cn(s.bar, 'h-1 top-8 left-1 w-6 opacity-20')} />
          <div className={cn(s.bar, 'h-1 top-10 left-1 w-10 opacity-15')} />
          <div className={cn(s.bar, 'h-1 top-12 left-1 w-8 opacity-10')} />

          <div className={cn(s.bar, 'h-3 bottom-1 left-1.5 w-10/12 opacity-10')} />
          <div className={cn(s.bar, 'h-1 bottom-2 left-5 w-8 opacity-30')} />
        </div>

        <div className={s.borderBox}>
          <div className={cn(s.bar, 'h-1 top-2 left-1 w-6 opacity-20')} />
          <div className={cn(s.bar, 'h-1.5 top-4 left-1 w-6 opacity-40')} />

          <div className={cn(s.bar, 'h-1 top-8 left-1 w-14 opacity-20')} />
          <div className={cn(s.bar, 'h-1 top-10 left-1 w-12 opacity-15')} />
          <div className={cn(s.bar, 'h-1 top-12 left-1 w-8 opacity-10')} />

          <div className={cn(s.bar, 'h-3 bottom-1 left-1.5 w-10/12 opacity-10')} />
          <div className={cn(s.bar, 'h-1 bottom-2 left-5 w-8 opacity-30')} />
        </div>

        <div className={s.borderBox}>
          <div className={cn(s.bar, 'h-1 top-2 left-1 w-6 opacity-20')} />
          <div className={cn(s.bar, 'h-1.5 top-4 left-1 w-12 opacity-40')} />

          <div className={cn(s.bar, 'h-1 top-8 left-1 w-12 opacity-20')} />
          <div className={cn(s.bar, 'h-1 top-10 left-1 w-16 opacity-15')} />
          <div className={cn(s.bar, 'h-1 top-12 left-1 w-10 opacity-10')} />

          <div className={cn(s.bar, 'h-3 bottom-1 left-1.5 w-10/12 opacity-10')} />
          <div className={cn(s.bar, 'h-1 bottom-2 left-5 w-8 opacity-30')} />
        </div>
      </div>
    )
  }

  if (layout === DOC_LAYOUT.LISTS) {
    return (
      <div className={s.block}>
        <div className={cn(s.iconBox, s.redBg, 'top-2 left-12')}>
          <ToolSVG className={cn(s.icon, s.red)} />
        </div>
        <div className={cn(s.bar, 'h-1.5 top-3 left-20 w-14')} />
        <div className={cn(s.bar, 'w-28 h-1 top-6 left-20 opacity-20')} />
        <div className={cn(s.bar, 'w-16 mt-0.5 h-1 top-8 left-20 opacity-10')} />

        <div className={cn(s.iconBox, s.blueBg, 'top-12 left-12')}>
          <ToolSVG className={cn(s.icon, s.blue)} />
        </div>
        <div className={cn(s.bar, 'h-1.5 top-14 -mt-1 left-20 w-16')} />
        <div className={cn(s.bar, 'w-24 h-1 top-16 left-20 opacity-20')} />
        <div className={cn(s.bar, 'w-20 mt-0.5 h-1 top-20 -mt-1.5 left-20 opacity-10')} />

        <div className={cn(s.iconBox, s.purpleBg, 'bottom-24 left-12')}>
          <ToolSVG className={cn(s.icon, s.purple)} />
        </div>
        <div className={cn(s.bar, 'h-1.5 bottom-24 mb-3 left-20 w-20')} />
        <div className={cn(s.bar, 'w-24 h-1 bottom-24 mb-0.5 left-20 opacity-20')} />
        <div className={cn(s.bar, 'w-10 mt-0.5 h-1 bottom-20 mb-2 left-20 opacity-10')} />

        <div className={cn(s.iconBox, s.brownBg, 'bottom-14 left-12')}>
          <ToolSVG className={cn(s.icon, s.brown)} />
        </div>
        <div className={cn(s.bar, 'h-1.5 bottom-14 mb-3 left-20 w-14')} />
        <div className={cn(s.bar, 'w-28 h-1 bottom-14 mb-0.5 left-20 opacity-20')} />
        <div className={cn(s.bar, 'w-10 mt-0.5 h-1 bottom-12 mt-1 left-20 opacity-10')} />

        <div className={cn(s.iconBox, s.greenBg, 'bottom-3 left-12')}>
          <ToolSVG className={cn(s.icon, s.green)} />
        </div>
        <div className={cn(s.bar, 'h-1.5 bottom-3 mb-3 left-20 w-14')} />
        <div className={cn(s.bar, 'w-28 h-1 bottom-3 mb-0.5 left-20 opacity-20')} />
        <div className={cn(s.bar, 'w-10 mt-0.5 h-1 bottom-1 mt-1 left-20 opacity-10')} />
      </div>
    )
  }

  return (
    <div className={cn(s.block, 'gap-x-7 gap-y-1 w-full')}>
      <div className={s.box}>
        <div className={cn(s.iconBox, s.redBg, 'top-0 left-1 scale-125')}>
          <ToolSVG className={cn(s.icon, s.red)} />
        </div>

        <div className={cn(s.bar, 'h-1 top-9 left-1 w-6 mt-0.5 opacity-20')} />
        <div className={cn(s.bar, 'h-1.5 top-12 left-1 w-8 opacity-40')} />

        <div className={cn(s.bar, 'h-1 top-14 mt-1.5 left-1 w-14 opacity-20')} />
        <div className={cn(s.bar, 'h-1 top-16 mt-2 left-1 w-10 opacity-10')} />
      </div>

      <div className={s.box}>
        <div className={cn(s.iconBox, s.blueBg, 'top-0 left-1 scale-125')}>
          <ToolSVG className={cn(s.icon, s.blue)} />
        </div>

        <div className={cn(s.bar, 'h-1 top-9 left-1 w-6 mt-0.5 opacity-20')} />
        <div className={cn(s.bar, 'h-1.5 top-12 left-1 w-12 opacity-40')} />

        <div className={cn(s.bar, 'h-1 top-14 mt-1.5 left-1 w-14 opacity-20')} />
        <div className={cn(s.bar, 'h-1 top-16 mt-2 left-1 w-10 opacity-10')} />
      </div>

      <div className={s.box}>
        <div className={cn(s.iconBox, s.purpleBg, 'top-0 left-1 scale-125')}>
          <ToolSVG className={cn(s.icon, s.purple)} />
        </div>

        <div className={cn(s.bar, 'h-1 top-9 left-1 w-6 mt-0.5 opacity-20')} />
        <div className={cn(s.bar, 'h-1.5 top-12 left-1 w-8 opacity-40')} />

        <div className={cn(s.bar, 'h-1 top-14 mt-1.5 left-1 w-16 opacity-20')} />
        <div className={cn(s.bar, 'h-1 top-16 mt-2 left-1 w-10 opacity-10')} />
      </div>

      <div className={s.box}>
        <div className={cn(s.iconBox, s.brownBg, 'top-0 left-1 scale-125')}>
          <ToolSVG className={cn(s.icon, s.brown)} />
        </div>

        <div className={cn(s.bar, 'h-1 top-9 left-1 w-6 mt-0.5 opacity-20')} />
        <div className={cn(s.bar, 'h-1.5 top-12 left-1 w-10 opacity-40')} />

        <div className={cn(s.bar, 'h-1 top-14 mt-1.5 left-1 w-12 opacity-20')} />
        <div className={cn(s.bar, 'h-1 top-16 mt-2 left-1 w-10 opacity-10')} />
      </div>

      <div className={s.box}>
        <div className={cn(s.iconBox, s.greenBg, 'top-0 left-1 scale-125')}>
          <ToolSVG className={cn(s.icon, s.green)} />
        </div>

        <div className={cn(s.bar, 'h-1 top-9 left-1 w-6 mt-0.5 opacity-20')} />
        <div className={cn(s.bar, 'h-1.5 top-12 left-1 w-12 opacity-40')} />

        <div className={cn(s.bar, 'h-1 top-14 mt-1.5 left-1 w-14 opacity-20')} />
        <div className={cn(s.bar, 'h-1 top-16 mt-2 left-1 w-8 opacity-10')} />
      </div>
    </div>
  )
}

export default MainTemplate
