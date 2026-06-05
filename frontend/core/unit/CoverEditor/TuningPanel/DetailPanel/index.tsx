import { useState } from 'react'

import { SegmentTab } from '~/widgets/Switcher'
import ThemeSwitchPreview from '~/widgets/ThemeSwitch/Preview'

import type { TTuningSetting } from '../../spec'
import BackgroundTab from './BackgroundTab'
import BasicTab from './BasicTab'
import useSalon from './salon'
import UploadTab from './UploadTab'

enum TAB {
  BASIC = 'basic',
  BACKGROUND = 'background',
  UPLOAD = 'upload',
}

const TAB_ITEMS = [
  {
    key: TAB.BASIC,
    label: 'Basic',
  },
  {
    key: TAB.BACKGROUND,
    label: 'Background',
  },
  {
    key: TAB.UPLOAD,
    label: 'Upload',
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
  const [tab, setTab] = useState<TAB>(TAB.BASIC)

  return (
    <div className={s.wrapper}>
      <div className={s.themeRow}>
        <ThemeSwitchPreview />
      </div>

      <div className={s.tabRow}>
        <SegmentTab
          items={TAB_ITEMS}
          activeKey={tab}
          ariaLabel='Cover settings tabs'
          onChange={(key) => setTab(key as TAB)}
        />
      </div>

      <div className={s.content}>
        {tab === TAB.BASIC && <BasicTab setting={setting} />}

        {tab === TAB.BACKGROUND && (
          <BackgroundTab
            wallpapers={setting.wallpapers}
            wallpaper={setting.wallpaper}
            direction={setting.direction}
          />
        )}

        {tab === TAB.UPLOAD && <UploadTab onDelete={onDelete} onReplace={onReplace} />}
      </div>

      <div className={s.collapseRow}>
        <button type='button' className={s.collapseBtn} onClick={onCollapse}>
          Collapse
        </button>
      </div>
    </div>
  )
}
