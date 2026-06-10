import { useState } from 'react'

import { SegmentTab } from '~/widgets/Switcher'
import ThemeSwitchPreview from '~/widgets/ThemeSwitch/Preview'

import type { TTuningSetting } from '../../spec'
import BackgroundTab from './BackgroundTab'
import BasicTab from './BasicTab'
import useSalon from './salon'

enum TAB {
  IMAGE = 'image',
  BACKGROUND = 'background',
}

const TAB_ITEMS = [
  {
    key: TAB.IMAGE,
    label: 'Image(s)',
  },
  {
    key: TAB.BACKGROUND,
    label: 'Background',
  },
] as const

type TProps = {
  setting: TTuningSetting
  onDelete: () => void
  onReplace: () => void
  onCollapse: () => void
}

export default function DetailPanel({ setting, onDelete, onReplace, onCollapse }: TProps) {
  const s = useSalon()
  const [tab, setTab] = useState<TAB>(TAB.IMAGE)

  return (
    <div className={s.wrapper}>
      <div className={s.topRow}>
        <SegmentTab
          items={TAB_ITEMS}
          activeKey={tab}
          ariaLabel='Cover settings tabs'
          onChange={(key) => setTab(key as TAB)}
        />

        <ThemeSwitchPreview />
      </div>

      <div className={s.content}>
        {tab === TAB.IMAGE && (
          <BasicTab setting={setting} onDelete={onDelete} onReplace={onReplace} />
        )}

        {tab === TAB.BACKGROUND && <BackgroundTab background={setting.activeBackground} />}
      </div>

      <div className={s.collapseRow}>
        <button type='button' className={s.collapseBtn} onClick={onCollapse}>
          Collapse
        </button>
      </div>
    </div>
  )
}
