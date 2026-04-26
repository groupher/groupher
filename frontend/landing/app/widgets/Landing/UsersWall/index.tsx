import { COLOR } from '~/const/colors'
import useTrans from '~/hooks/useTrans'
import { mockUsers } from '~/mock'
import type { TTransKey } from '~/spec'
import MasonryCards from '~/widgets/MasonryCards'

import useSalon from '../salon/users_wall'
import Card from './Card'
import { P1, P2, P3 } from './Contents'

type TTranslate = (key: TTransKey) => string

const CardsList = ({ t }: { t: TTranslate }) => {
  const users = mockUsers(10)
  const s = useSalon()

  return (
    <MasonryCards column={3}>
      <Card content={P1(s, COLOR.BLUE, t)} user={users[0]} color={COLOR.BLUE} />
      <Card content={P2(s, COLOR.ORANGE, t)} user={users[1]} color={COLOR.ORANGE} />
      <Card content={P1(s, COLOR.RED, t)} user={users[2]} color={COLOR.RED} />
      <Card content={P1(s, COLOR.GREEN, t)} user={users[3]} color={COLOR.GREEN} />
      <Card content={P3(s, COLOR.CYAN, t)} user={users[4]} color={COLOR.CYAN} />
      <Card content={P1(s, COLOR.PURPLE, t)} user={users[5]} color={COLOR.PURPLE} />
      <Card content={P2(s, COLOR.YELLOW, t)} user={users[6]} color={COLOR.YELLOW} />
      <Card content={P1(s, COLOR.BLUE, t)} user={users[7]} color={COLOR.BLUE} />
      <Card content={P1(s, COLOR.BROWN, t)} user={users[8]} color={COLOR.BROWN} />
    </MasonryCards>
  )
}

export default function UsersWall() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <section className={s.wrapper}>
      <div className={s.slogan}>
        <div className={s.topping}>{t('landing.users.topping')}</div>
        <h3 className={s.title}>{t('landing.users.title')}</h3>
        <div className={s.desc}>{t('landing.users.desc')}</div>
      </div>

      <div className={s.paper}>
        <div className={s.paperInner}>
          <CardsList t={t} />
        </div>
      </div>
    </section>
  )
}
