import useTrans from '~/hooks/useTrans'
import Portal from '../Portal'
import useSalon from '../salon/overview'
import BasicNumbers from './BasicNumbers'

export default function Overview() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <Portal
        title={t('dsb.overview.portal.title')}
        desc={t('dsb.overview.portal.desc')}
        testid='dashboard-overview-title'
      />
      <section className={s.section}>
        <BasicNumbers />
        {/* <SectionLabel title="基本信息" /> */}
      </section>
    </div>
  )
}
