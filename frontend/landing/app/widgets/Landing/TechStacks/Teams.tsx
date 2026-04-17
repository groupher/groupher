import useTrans from '~/hooks/useTrans'
import { mockUsers } from '~/mock'
import Facepile from '~/widgets/Facepile/LandingPage'

import useSalon from '../salon/tech_stacks/teams'

export default function Teams() {
  const s = useSalon()
  const { t } = useTrans()

  const users = mockUsers(7)

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <div className={s.title}>{t('landing.tech.teams.title')}</div>
        <div className={s.count}>32+</div>
      </div>

      <Facepile users={users} className='gap-x-2 opacity-80' />
    </div>
  )
}
