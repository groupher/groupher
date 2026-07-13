import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import { Tabs } from '~/widgets/Switcher'

import { TAB_ITEMS } from './constant'
import useSalon from './salon/picker_header'
import type { TTab } from './spec'

type TProps = {
  tab: TTab
  appearance: boolean
  appearanceOpen: boolean
  appearanceColor: string
  appearanceBg: string
  onTabChange: (tab: TTab) => void
  onAppearanceToggle: () => void
}

const PickerHeader: FC<TProps> = ({
  tab,
  appearance,
  appearanceOpen,
  appearanceColor,
  appearanceBg,
  onTabChange,
  onAppearanceToggle,
}) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <Tabs
        items={TAB_ITEMS}
        activeKey={appearanceOpen ? '' : tab}
        onChange={(key) => onTabChange(key as TTab)}
        left={1.5}
        bottom={1.5}
      />

      {appearance && (
        <button
          type='button'
          aria-label={t('dsb.portal.appearance.title')}
          aria-pressed={appearanceOpen}
          className={s.appearanceButton}
          onClick={onAppearanceToggle}
        >
          <span
            aria-hidden
            className={s.appearancePreview}
            style={{ backgroundColor: appearanceBg }}
          >
            <span className={s.appearancePreviewDot} style={{ backgroundColor: appearanceColor }} />
          </span>
        </button>
      )}
    </div>
  )
}

export default PickerHeader
