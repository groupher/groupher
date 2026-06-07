import useTrans from '~/hooks/useTrans'

import SectionLabel from '../../../SectionLabel'
import type { TThemeDetails, TThemePresetOption } from '../spec'
import Colors from './Colors'
import GlassOpacity from './GlassOpacity'
import PageBackground from './PageBackground'
import PageGlow from './PageGlow'
import ResetToPresetMenu from './ResetToPresetMenu'
import useSalon from './salon'

type TProps = {
  details: TThemeDetails
  showResetMenu: boolean
  activePresetBase: TThemePresetOption['value']
  presetOptions: readonly TThemePresetOption[]
  touched: boolean
  onResetPreset: (preset: TThemePresetOption) => void
}

export default function DetailsPanel({
  details,
  showResetMenu,
  activePresetBase,
  presetOptions,
  touched,
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
          touched={touched}
          addon={
            showResetMenu ? (
              <ResetToPresetMenu
                activePresetBase={activePresetBase}
                presetOptions={presetOptions}
                onReset={onResetPreset}
              />
            ) : null
          }
        />
      </div>

      <div className={s.content}>
        <Colors details={details} />

        <PageBackground details={details} />

        <GlassOpacity details={details} />

        <div className={s.divider} />

        <PageGlow details={details} />
      </div>
    </div>
  )
}
