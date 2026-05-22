import useTrans from '~/hooks/useTrans'

import SectionLabel from '../../../SectionLabel'
import useSalon from '../salon/details_panel'
import type { TThemeDetails, TThemePresetOption } from '../spec'
import Colors from './Colors'
import GlassOpacity from './GlassOpacity'
import PageBackground from './PageBackground'
import PageGlow from './PageGlow'
import ResetToPresetMenu from './ResetToPresetMenu'

type TProps = {
  details: TThemeDetails
  showResetMenu: boolean
  activePresetBase: TThemePresetOption['value']
  onResetPreset: (preset: TThemePresetOption) => void
}

export default function DetailsPanel({
  details,
  showResetMenu,
  activePresetBase,
  onResetPreset,
}: TProps) {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <SectionLabel
          title={t('dsb.appearance.theme.preset.detail')}
          desc={t('dsb.appearance.theme.preset.desc')}
          addon={
            showResetMenu ? (
              <ResetToPresetMenu activePresetBase={activePresetBase} onReset={onResetPreset} />
            ) : null
          }
        />
      </div>

      <div className={s.content}>
        <Colors details={details} />
        <div className={s.divider} />

        <PageBackground details={details} />

        <GlassOpacity details={details} />

        <div className={s.divider} />

        <PageGlow details={details} />
      </div>
    </div>
  )
}
