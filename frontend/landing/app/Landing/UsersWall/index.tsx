import { COLOR_NAME } from '~/const/colors'
import { mockUsers } from '~/mock'

import MasonryCards from '~/widgets/MasonryCards'

import useSalon from '../salon/users_wall'
import Card from './Card'
import { P1, P2, P3 } from './Contents'

const CardsList = () => {
  const users = mockUsers(10)

  return (
    <MasonryCards column={3}>
      <Card content={P1(COLOR_NAME.BLUE)} user={users[0]} color={COLOR_NAME.BLUE} />
      <Card content={P2(COLOR_NAME.ORANGE)} user={users[1]} color={COLOR_NAME.ORANGE} />
      <Card content={P1(COLOR_NAME.RED)} user={users[2]} color={COLOR_NAME.RED} />
      <Card content={P1(COLOR_NAME.GREEN)} user={users[3]} color={COLOR_NAME.GREEN} />
      <Card content={P3(COLOR_NAME.CYAN)} user={users[4]} color={COLOR_NAME.CYAN} />
      <Card content={P1(COLOR_NAME.PURPLE)} user={users[5]} color={COLOR_NAME.PURPLE} />
      <Card content={P2(COLOR_NAME.YELLOW)} user={users[6]} color={COLOR_NAME.YELLOW} />
      <Card content={P1(COLOR_NAME.BLUE)} user={users[7]} color={COLOR_NAME.BLUE} />
      <Card content={P1(COLOR_NAME.BROWN)} user={users[8]} color={COLOR_NAME.BROWN} />
    </MasonryCards>
  )
}

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.slogan}>
        <h3 className={s.title}>被众多优秀开发者和团队青睐</h3>
        <div className={s.desc}>从独立开发者到中小型创业团队，我们用产品力回报信任</div>
      </div>

      <div className={s.bgGradient} />

      <div className={s.wall}>
        <CardsList />
      </div>
    </div>
  )
}
