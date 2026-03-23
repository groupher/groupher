import type { FC } from 'react'
import { mockUsers } from '~/mock'
import type { TColorName } from '~/spec'
import ArrowButton from '~/widgets/Buttons/ArrowButton'
import Facepile from '~/widgets/Facepile'
import FaIcons from '~/widgets/FaIcons'
import useSalon from '../salon/lists_layout/category'
import useLogic from '../useLogic'

type TProps = {
  color: TColorName
  title: string
  desc?: string
}

const Category: FC<TProps> = ({ color, title, desc }) => {
  const s = useSalon({ color })
  const { gotoDetailLayout } = useLogic()

  return (
    <div className={s.wrapper}>
      <div className={s.cover}>
        <div className={s.iconBox}>
          <FaIcons icon='music' size={25} color={color} opacity={0.6} />
        </div>
      </div>
      <div className={s.content}>
        <h3 className={s.title}>{title}</h3>
        {desc && <div className={s.desc}>{desc}</div>}
        <div className={s.footer}>
          <Facepile size='small' users={mockUsers(6)} total={20} />
          <div className={s.authorHint}>6 位共同编辑</div>
          <div className='grow' />
          <ArrowButton className={s.moreLink} onClick={() => gotoDetailLayout()}>
            9 篇文档
          </ArrowButton>
        </div>
      </div>
    </div>
  )
}

export default Category
