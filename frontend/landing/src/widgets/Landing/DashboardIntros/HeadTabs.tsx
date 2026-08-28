import { keys } from 'ramda'

import useSalon, { cn } from '../salon/dashboard_intros/head_tabs'
import INTROS from './constant'
import type { TIntroTab } from './spec'

type TProps = {
  tab: TIntroTab
  onChange: (tab: TIntroTab) => void
}

export default function HeadTabs({ tab, onChange }: TProps) {
  const tabKeys = keys(INTROS)

  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {tabKeys.map((tabKey) => {
        const intro = INTROS[tabKey]
        const { title, color, icon } = intro
        const Icon = icon

        const isActive = tabKey === tab

        const activeColor = `${color.toLowerCase()}Active`
        const iconBoxColor = `${color.toLowerCase()}IconBox`

        return (
          <button
            type='button'
            key={tabKey}
            className={cn(s.button, isActive && s[activeColor])}
            onClick={() => onChange(tabKey as TIntroTab)}
          >
            <div className={cn(s.iconBox, s[iconBoxColor], isActive && 'opacity-60')}>
              <Icon className={s.icon} />
            </div>
            {title}
          </button>
        )
      })}
    </div>
  )
}
