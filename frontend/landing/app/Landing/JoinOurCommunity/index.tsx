import { mockUsers } from '~/mock'
import Facepile from '~/widgets/Facepile'
import useSalon from '../salon/join_our_community'
import Cards from './Cards'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.divider} />
      <div className={s.paper}>
        <div className={s.slogan}>
          <Facepile users={mockUsers(6)} total={6} left={1.5} bottom={3} showMore={false} />
          <h3 className={s.title}>加入我们的社区</h3>
          <div className={s.desc}>和其他的用户、开发者一起建立连接。</div>
        </div>
        <Cards />
      </div>
      <div className={s.divider} />
    </div>
  )
}
