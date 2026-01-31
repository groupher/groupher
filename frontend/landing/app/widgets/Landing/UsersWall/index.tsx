import { COLOR } from '~/const/colors'
import { mockUsers } from '~/mock'

import MasonryCards from '~/widgets/MasonryCards'

import useSalon from '../salon/users_wall'
import Card from './Card'
import { P1, P2, P3 } from './Contents'

const CardsList = () => {
  const users = mockUsers(10)

  return (
    <MasonryCards column={3}>
      <Card content={P1(COLOR.BLUE)} user={users[0]} color={COLOR.BLUE} />
      <Card content={P2(COLOR.ORANGE)} user={users[1]} color={COLOR.ORANGE} />
      <Card content={P1(COLOR.RED)} user={users[2]} color={COLOR.RED} />
      <Card content={P1(COLOR.GREEN)} user={users[3]} color={COLOR.GREEN} />
      <Card content={P3(COLOR.CYAN)} user={users[4]} color={COLOR.CYAN} />
      <Card content={P1(COLOR.PURPLE)} user={users[5]} color={COLOR.PURPLE} />
      <Card content={P2(COLOR.YELLOW)} user={users[6]} color={COLOR.YELLOW} />
      <Card content={P1(COLOR.BLUE)} user={users[7]} color={COLOR.BLUE} />
      <Card content={P1(COLOR.BROWN)} user={users[8]} color={COLOR.BROWN} />
    </MasonryCards>
  )
}

export default function UsersWall() {
  const s = useSalon()

  return (
    <section className={s.wrapper}>
      <div className={s.slogan}>
        <div className={s.topping}>Trust with 💗</div>
        <h3 className={s.title}>被众多优秀团队信赖</h3>
        <div className={s.desc}>从独立开发者到中小型创业团队，我们用产品力回报信任</div>
      </div>

      <div className={s.paper}>
        <div className={s.paperInner}>
          <CardsList />
        </div>
      </div>
    </section>
  )
}
