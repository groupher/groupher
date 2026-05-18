import type { Dispatch, SetStateAction } from 'react'

import useTrans from '~/hooks/useTrans'
import Button from '~/widgets/Buttons/Button'

import useSalon from '../../salon/layout/details_panel'
import CustomBackground from '../PageBackground/CustomBackground'
import type { TPageBgDraft } from '../PageBackground/hooks'
import PrimaryColors from './PrimaryColors'
import type { TEditDashboardField, TThemePresetOverrides } from './spec'

type TProps = {
  selectedOverrides: TThemePresetOverrides
  selectedPageBgDraft: TPageBgDraft
  pageBgDraft: TPageBgDraft
  setPageBgDraft: Dispatch<SetStateAction<TPageBgDraft>>
  primaryCustomColor: string
  isLightTheme: boolean
  editField: TEditDashboardField
}

export default function DetailsPanel({
  selectedOverrides,
  selectedPageBgDraft,
  pageBgDraft,
  setPageBgDraft,
  primaryCustomColor,
  isLightTheme,
  editField,
}: TProps) {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.details}>
      <div className={s.detailsHeader}>
        <div className={s.detailsTitle}>{t('dsb.layout.appearance.details')}</div>
        <div className='grow' />
        <Button ghost noBorder size='small'>
          {t('dsb.layout.appearance.customize')}
        </Button>
      </div>

      <div className={s.detailDivider}>
        <PrimaryColors
          selectedOverrides={selectedOverrides}
          primaryCustomColor={primaryCustomColor}
          isLightTheme={isLightTheme}
          editField={editField}
        />

        <CustomBackground
          draft={pageBgDraft}
          originalDraft={selectedPageBgDraft}
          onDraftChange={(patch) => setPageBgDraft((prev) => ({ ...prev, ...patch }))}
          showToggle={false}
          showThemeSelector={false}
        />
      </div>
    </div>
  )
}
