import useTrans from '~/hooks/useTrans'

import SectionLabel from '../../../SectionLabel'
import useSalon from '../salon/details_panel'
import type { TThemeDetails } from '../spec'
import Colors from './Colors'
import GlassOpacity from './GlassOpacity'
import PageBackground from './PageBackground'
import PageGlow from './PageGlow'

type TProps = {
  details: TThemeDetails
}

export default function DetailsPanel({ details }: TProps) {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <SectionLabel
          title={t('dsb.appearance.theme.preset.detail')}
          desc={t('dsb.appearance.theme.preset.desc')}
          addon={<span>{t('dsb.appearance.theme.customize')}</span>}
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
