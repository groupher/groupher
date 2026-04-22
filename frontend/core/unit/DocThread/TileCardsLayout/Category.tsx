import type { FC } from 'react'
import { mockUsers } from '~/mock'
import type { TArticle, TColorName } from '~/spec'
import DotDivider from '~/widgets/DotDivider'
import Facepile from '~/widgets/Facepile'
import FaIcons from '~/widgets/FaIcons'
import useSalon from '../salon/tile_cards_layout/category'
import useLogic from '../useLogic'

type TProps = {
  title: string
  desc: string
  color: TColorName
  articles: TArticle[]
}

const Category: FC<TProps> = ({ title, desc, color, articles }) => {
  const s = useSalon({ color })
  const { gotoDetailLayout } = useLogic()

  return (
    <button type='button' className={s.wrapper} onClick={() => gotoDetailLayout()}>
      <div className={s.iconBox}>
        <FaIcons icon='music' size={20} color={color} opacity={0.7} />
      </div>

      <h3 className={s.title}>{title}</h3>
      <p className={s.desc}>{desc}</p>

      <div className={s.footer}>
        <Facepile users={mockUsers(2)} total={2} showMore={false} />
        <div className={s.count}>{articles.length} author</div>
        <DotDivider className='mx-2' />
        <div className={s.count}>{articles.length} articles</div>
        <div className='grow' />
      </div>
    </button>
  )
}

export default Category
