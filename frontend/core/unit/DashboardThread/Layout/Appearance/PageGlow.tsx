import useTrans from '~/hooks/useTrans'
import useGlowLight from '~/unit/DashboardThread/logic/useGlowLight'
import useCustomPageBgSalon from '~/widgets/CustomPageBg/salon'

import useSalon from './salon/page_glow'
import TextureBalls from './TextureBalls'

export default function PageGlow() {
  const s = useSalon()
  const row = useCustomPageBgSalon()
  const { t } = useTrans()
  const { glowType, edit } = useGlowLight()

  return (
    <div className={row.settingRow}>
      <div className={row.labelGroup}>
        <div className={row.label}>{t('dsb.layout.glow.title')}</div>
        <div className={row.hint}>{t('dsb.layout.glow.desc')}</div>
      </div>

      <div className='grow' />
      <div className={s.swatches}>
        <TextureBalls glowType={glowType} edit={edit} rowClassName={s.swatchRow} />
      </div>
    </div>
  )
}
