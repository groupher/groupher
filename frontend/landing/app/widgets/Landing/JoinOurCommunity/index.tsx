import useTrans from '~/hooks/useTrans'
import { mockUsers } from '~/mock'
import Facepile from '~/widgets/Facepile'

import useSalon from '../salon/join_our_community'
import Cards from './Cards'

export default function JoinOurCommunity() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <section className={s.wrapper}>
      <div className={s.divider} />
      <div className={s.paper}>
        <div className={s.slogan}>
          <Facepile users={mockUsers(6)} total={6} left={1.5} bottom={3} showMore={false} />
          <h3 className={s.title}>{t('landing.join.title')}</h3>
          <div className={s.desc}>{t('landing.join.desc')}</div>
        </div>
        <Cards />
      </div>
      <div className={s.divider} />
    </section>
  )
}
