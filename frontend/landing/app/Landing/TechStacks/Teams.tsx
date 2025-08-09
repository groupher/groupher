import { mockUsers } from '~/mock'

import Facepile from '~/widgets/Facepile/LandingPage'

import useSalon from '../salon/tech_stacks/teams'

export default () => {
  const s = useSalon()

  const users = mockUsers(7)

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <div className={s.title}>贡献者</div>
        <div className={s.count}>+32</div>
      </div>

      <Facepile users={users} className='gap-x-2 opacity-80' />
    </div>
  )
}
